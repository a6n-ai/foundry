import { AwsError, awsConfigFromEnv, createAwsClient, type AwsConfig } from "@foundry/cloud";
import { AppError } from "@foundry/commons";
import {
  AbstractEmailProvider,
  type EmailProviderConfig,
} from "./provider";
import type { EmailAddress, PreparedEmail, SendResult } from "./types";

export interface SesProviderConfig extends EmailProviderConfig, AwsConfig {
  /**
   * SES configuration set — routes bounce/complaint/delivery events to the
   * SNS feedback topic. Required for the suppression webhook to work.
   */
  configurationSetName?: string;
}

interface SendEmailResponse { MessageId?: string }

const SEND_BUDGET = { retries: 1, timeoutMs: 10_000 };

function formatAddress({ email, name }: EmailAddress): string {
  // ponytail: RFC2047 encoding skipped — add when a sender name needs non-ASCII.
  return name ? `${name} <${email}>` : email;
}

export class SesEmailProvider extends AbstractEmailProvider {
  readonly name = "ses";
  private readonly aws: ReturnType<typeof createAwsClient>;
  private readonly configurationSetName?: string;

  constructor(config: SesProviderConfig) {
    super(config);
    const env = awsConfigFromEnv();
    this.aws = createAwsClient("ses", {
      region: config.region ?? env.region,
      credentials: config.credentials ?? env.credentials,
      fetch: config.fetch,
    });
    this.configurationSetName = config.configurationSetName;
  }

  protected async deliver(message: PreparedEmail): Promise<SendResult> {
    const to = Array.isArray(message.to) ? message.to : [message.to];
    const body = {
      FromEmailAddress: formatAddress(message.from),
      Destination: {
        ToAddresses: to.map(formatAddress),
        CcAddresses: message.cc?.map(formatAddress),
        BccAddresses: message.bcc?.map(formatAddress),
      },
      ReplyToAddresses: message.replyTo ? [formatAddress(message.replyTo)] : undefined,
      ConfigurationSetName: this.configurationSetName,
      Content: {
        Simple: {
          Subject: { Data: message.subject, Charset: "UTF-8" },
          Body: {
            Html: message.html ? { Data: message.html, Charset: "UTF-8" } : undefined,
            Text: message.text ? { Data: message.text, Charset: "UTF-8" } : undefined,
          },
        },
      },
    };

    let out: SendEmailResponse;
    try {
      // Region is read inside the try: the client throws MissingRegion lazily.
      out = await this.aws.json<SendEmailResponse>(
        `https://email.${this.aws.region}.amazonaws.com/v2/email/outbound-emails`,
        { method: "POST", json: body, ...SEND_BUDGET },
      );
    } catch (e) {
      // Callers catch AppError, not the signer's AwsError; an unconfigured env must fail the same way a rejected send does.
      if (e instanceof AwsError && (e.code === "MissingCredentials" || e.code === "MissingRegion")) {
        throw new AppError(e.message, 500);
      }
      throw e;
    }
    if (!out?.MessageId) {
      throw new AppError("SES returned no MessageId", 502);
    }
    return { providerMessageId: out.MessageId, provider: this.name };
  }
}
