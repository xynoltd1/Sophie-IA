import { createHmac, timingSafeEqual } from "node:crypto";
import type {
  MessageStatus,
  MessagingProvider,
  OutboundMessage,
  SendResult,
} from "./types";

/**
 * Envoi de SMS par un opérateur programmable compatible Twilio.
 *
 * Choisi parce que c'est le seul à couvrir la Belgique et la France avec des
 * numéros d'expéditeur alphanumériques, et parce que son interface est
 * suffisamment répandue pour que d'autres opérateurs l'imitent.
 *
 * Rien ici n'a été exercé contre le service réel : aucun compte n'existe
 * encore. Le registre des intégrations le dit (`BLOCKED_EXTERNAL_CONFIG`), et
 * il ne faut pas le déclarer testé avant qu'un vrai SMS soit arrivé sur un vrai
 * téléphone.
 */
export class TwilioMessagingProvider implements MessagingProvider {
  readonly name = "twilio";
  readonly supportedChannels = ["SMS"] as const;
  readonly isMock = false;

  constructor(
    private readonly accountSid: string,
    private readonly authToken: string,
    private readonly sender: string,
    private readonly baseUrl = "https://api.twilio.com",
  ) {}

  async send(message: OutboundMessage): Promise<SendResult> {
    const corps = new URLSearchParams({
      To: message.to,
      Body: message.body,
      // Un expéditeur alphanumérique (« SOPHIE ») ou un numéro E.164 : les
      // deux formes sont acceptées, l'opérateur tranche selon le pays.
      From: this.sender,
    });

    let reponse: Response;
    try {
      reponse = await fetch(
        `${this.baseUrl}/2010-04-01/Accounts/${this.accountSid}/Messages.json`,
        {
          method: "POST",
          headers: {
            "content-type": "application/x-www-form-urlencoded",
            authorization:
              "Basic " + Buffer.from(`${this.accountSid}:${this.authToken}`).toString("base64"),
            // L'opérateur refuse un second envoi portant la même clé : c'est
            // notre garantie qu'un webhook rejoué n'envoie pas deux SMS.
            "i-twilio-idempotency-token": message.idempotencyKey,
          },
          body: corps.toString(),
          signal: AbortSignal.timeout(15_000),
        },
      );
    } catch (cause) {
      return {
        status: "FAILED",
        error:
          cause instanceof Error && cause.name === "TimeoutError"
            ? "L'opérateur n'a pas répondu en 15 secondes."
            : "L'opérateur est injoignable.",
        retryable: true,
      };
    }

    const charge = (await reponse.json().catch(() => null)) as {
      sid?: string;
      status?: string;
      message?: string;
      code?: number;
    } | null;

    if (!reponse.ok) {
      return {
        status: "FAILED",
        error: `L'opérateur a répondu ${reponse.status} : ${charge?.message ?? "sans détail"}`,
        // 429 et 5xx passent avec le temps. Un numéro invalide ou un compte
        // sans crédit ne passera jamais : réessayer ne ferait que retarder le
        // diagnostic.
        retryable: reponse.status === 429 || reponse.status >= 500,
      };
    }

    return {
      status: statutDepuisOperateur(charge?.status),
      providerMessageId: charge?.sid,
    };
  }

  /**
   * Les accusés de réception sont signés. Sans cette vérification, n'importe
   * qui pourrait déclarer nos messages « échoués » ou « livrés ».
   */
  verifyWebhook(params: { rawBody: string; headers: Record<string, string> }): boolean {
    const signature = params.headers["x-twilio-signature"];
    const url = params.headers["x-webhook-url"];
    if (!signature || !url) return false;

    const attendu = createHmac("sha1", this.authToken).update(url + params.rawBody).digest("base64");

    const a = Buffer.from(signature);
    const b = Buffer.from(attendu);
    return a.length === b.length && timingSafeEqual(a, b);
  }

  parseStatusUpdate(rawBody: string): { providerMessageId: string; status: MessageStatus } | null {
    const champs = new URLSearchParams(rawBody);
    const sid = champs.get("MessageSid") ?? champs.get("SmsSid");
    const statut = champs.get("MessageStatus") ?? champs.get("SmsStatus");
    if (!sid || !statut) return null;
    return { providerMessageId: sid, status: statutDepuisOperateur(statut) };
  }
}

function statutDepuisOperateur(statut: string | undefined): MessageStatus {
  switch ((statut ?? "").toLowerCase()) {
    case "delivered":
      return "DELIVERED";
    case "failed":
    case "undelivered":
      return "FAILED";
    case "queued":
    case "accepted":
    case "scheduled":
      return "QUEUED";
    default:
      return "SENT";
  }
}
