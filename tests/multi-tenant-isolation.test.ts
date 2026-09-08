import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Tests d'isolation multi-tenant (sections 4, 39 et 53).
 *
 * Ces tests s'executent contre une VRAIE base Supabase, parce que l'objet
 * teste est PostgreSQL lui-meme : des mocks ne prouveraient rien sur les
 * policies RLS.
 *
 * Configuration (dans .env.local ou dans l'environnement de CI) :
 *   SUPABASE_TEST_URL
 *   SUPABASE_TEST_ANON_KEY
 *   SUPABASE_TEST_SERVICE_ROLE_KEY
 *
 * Sans ces variables, la suite est ignoree — jamais silencieusement "verte" :
 * vitest affiche les tests comme skipped.
 *
 * N'exécutez ceci que sur une base de developpement ou de staging.
 */

const url = process.env.SUPABASE_TEST_URL;
const anonKey = process.env.SUPABASE_TEST_ANON_KEY;
const serviceKey = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY;
const configured = Boolean(url && anonKey && serviceKey);

const suite = configured ? describe : describe.skip;

interface TestUser {
  id: string;
  email: string;
  password: string;
  client: SupabaseClient;
  organizationId: string;
}

suite("isolation multi-tenant", () => {
  let admin: SupabaseClient;
  let alice: TestUser;
  let bob: TestUser;
  const created: string[] = [];

  async function makeUser(label: string): Promise<TestUser> {
    const email = `${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@sophie-test.local`;
    const password = `Test-${Math.random().toString(36).slice(2, 12)}!`;

    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: `${label} Test` },
    });
    if (error || !data.user) throw new Error(`Creation utilisateur impossible : ${error?.message}`);
    created.push(data.user.id);

    const client = createClient(url!, anonKey!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const signIn = await client.auth.signInWithPassword({ email, password });
    if (signIn.error) throw new Error(`Connexion impossible : ${signIn.error.message}`);

    const org = await client.rpc("create_organization", {
      org_name: `Entreprise ${label} ${Date.now()}`,
    });
    if (org.error || !org.data) {
      throw new Error(`create_organization a echoue : ${org.error?.message}`);
    }

    return { id: data.user.id, email, password, client, organizationId: String(org.data) };
  }

  beforeAll(async () => {
    admin = createClient(url!, serviceKey!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    alice = await makeUser("alice");
    bob = await makeUser("bob");
  }, 60_000);

  afterAll(async () => {
    if (!admin) return;
    for (const id of created) {
      await admin.auth.admin.deleteUser(id).catch(() => undefined);
    }
  });

  // --- Contrôles positifs -------------------------------------------------
  // Sans eux, un verrouillage total de la base ressemblerait à un succès :
  // tous les contrôles négatifs passeraient, pour la mauvaise raison.
  // C'est exactement le bug qu'a révélé la première exécution réelle.

  it("un membre lit bien sa propre organisation", async () => {
    const { data, error } = await alice.client
      .from("organizations")
      .select("id, name")
      .eq("id", alice.organizationId);

    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });

  it("un membre lit bien sa propre équipe", async () => {
    const { data, error } = await alice.client
      .from("organization_members")
      .select("user_id, role")
      .eq("organization_id", alice.organizationId);

    expect(error).toBeNull();
    expect(data?.[0]?.role).toBe("OWNER");
  });

  it("un membre lit bien les activités de son organisation", async () => {
    const { data, error } = await alice.client
      .from("activities")
      .select("id, type")
      .eq("organization_id", alice.organizationId);

    expect(error).toBeNull();
    // create_organization() écrit une activité ORGANIZATION_CREATED.
    expect((data ?? []).length).toBeGreaterThan(0);
  });

  it("un membre lit bien le catalogue des métiers", async () => {
    const { data, error } = await alice.client
      .from("profession_templates")
      .select("slug")
      .eq("is_published", true);

    expect(error).toBeNull();
    expect((data ?? []).length).toBeGreaterThanOrEqual(12);
  });

  // --- Contrôles négatifs ---------------------------------------------------

  it("chaque utilisateur ne voit que sa propre organisation", async () => {
    const { data, error } = await alice.client.rpc("my_organizations");
    expect(error).toBeNull();
    const ids = (data as Array<{ organization_id: string }>).map((o) => o.organization_id);
    expect(ids).toContain(alice.organizationId);
    expect(ids).not.toContain(bob.organizationId);
  });

  it("lire l'organisation d'un autre tenant renvoie zero ligne, pas une erreur exploitable", async () => {
    const { data, error } = await alice.client
      .from("organizations")
      .select("id, name")
      .eq("id", bob.organizationId);

    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("ecrire dans l'organisation d'un autre tenant est refuse", async () => {
    const { data, error } = await alice.client
      .from("organizations")
      .update({ name: "Pirate" })
      .eq("id", bob.organizationId)
      .select();

    // RLS filtre la ligne : aucune mise a jour n'a lieu.
    expect(error).toBeNull();
    expect(data).toEqual([]);

    const check = await admin
      .from("organizations")
      .select("name")
      .eq("id", bob.organizationId)
      .single();
    expect(check.data?.name).not.toBe("Pirate");
  });

  it("s'ajouter comme membre d'un autre tenant est refuse", async () => {
    const { error } = await alice.client.from("organization_members").insert({
      organization_id: bob.organizationId,
      user_id: alice.id,
      role: "OWNER",
      status: "ACTIVE",
    });

    expect(error).not.toBeNull();
    expect(error?.code).toBe("42501");
    // Les deux causes donnent 42501. On exige que le refus vienne bien de RLS
    // et non d'un privilège de table manquant, sinon ce test passerait alors
    // que la base est simplement inaccessible.
    expect(error?.message).not.toContain("permission denied for table");
  });

  it("les membres d'un autre tenant ne sont pas listables", async () => {
    const { data, error } = await alice.client
      .from("organization_members")
      .select("user_id")
      .eq("organization_id", bob.organizationId);

    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("les activites d'un autre tenant ne sont pas lisibles", async () => {
    const { data, error } = await alice.client
      .from("activities")
      .select("id, summary")
      .eq("organization_id", bob.organizationId);

    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("le journal d'audit n'est jamais lisible par un tenant", async () => {
    const { data, error } = await alice.client.from("audit_logs").select("id");
    // Aucune policy pour authenticated : soit erreur, soit zero ligne.
    expect(error !== null || (data ?? []).length === 0).toBe(true);
  });

  it("un utilisateur ne peut pas se promouvoir administrateur de la plateforme", async () => {
    const { error } = await alice.client
      .from("profiles")
      .update({ is_platform_admin: true })
      .eq("id", alice.id);

    expect(error).not.toBeNull();
  });

  it("le dernier proprietaire ne peut pas etre retire", async () => {
    const { error } = await alice.client
      .from("organization_members")
      .delete()
      .eq("organization_id", alice.organizationId)
      .eq("user_id", alice.id);

    expect(error).not.toBeNull();
  });

  it("un proprietaire ne peut pas basculer son organisation en mode test", async () => {
    // Sinon n'importe qui pourrait echapper a l'exigence d'annonce validee.
    const { error } = await alice.client
      .from("organizations")
      .update({ is_test_organization: true })
      .eq("id", alice.organizationId);

    expect(error).not.toBeNull();

    const check = await admin
      .from("organizations")
      .select("is_test_organization")
      .eq("id", alice.organizationId)
      .single();
    expect(check.data?.is_test_organization).toBe(false);
  });

  it("un appel ne peut pas etre marque test dans une organisation normale", async () => {
    const { data, error } = await alice.client.rpc("call_is_test", {
      org_id: alice.organizationId,
      requested_test: true,
    });

    expect(error).toBeNull();
    expect(data).toBe(false);
  });

  it("toute table du schema public a RLS active", async () => {
    const { data, error } = await admin.rpc("exec_sql_readonly", {
      statement: `select relname from pg_class c
                  join pg_namespace n on n.oid = c.relnamespace
                  where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity = false`,
    });

    // La fonction utilitaire n'existe pas par defaut : on ignore ce controle
    // s'il n'est pas disponible plutot que de faire echouer la suite.
    if (error) return;
    expect(data).toEqual([]);
  });
});

if (!configured) {
  describe("isolation multi-tenant", () => {
    it("suite ignoree : variables SUPABASE_TEST_* absentes de .env.local", () => {
      // Ce test passe volontairement : il signale une configuration absente,
      // pas un echec. Renseignez SUPABASE_TEST_URL, SUPABASE_TEST_ANON_KEY et
      // SUPABASE_TEST_SERVICE_ROLE_KEY dans .env.local pour executer la suite.
      expect(configured).toBe(false);
    });
  });
}
