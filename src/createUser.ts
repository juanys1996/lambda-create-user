import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "crypto";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TABLE = process.env.TABLE_NAME!;

type Body = {
  organizationId?: string;       // requerido
  profile?: string;              // requerido
  email?: string;                // requerido
  status?: string;               // opcional
  metadata?: Record<string, any>;// opcional
  name?: string;                 // opcional
};

const json = (code: number, body: unknown) => ({
  statusCode: code,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

const isEmail = (s: unknown) =>
  typeof s === "string" && /.+@.+\..+/.test(s);

export const handler = async (event: any) => {
  try {
    const body: Body = JSON.parse(event.body || "{}");

    // Validaciones mínimas
    if (!body?.organizationId)
      return json(400, { message: "organizationId requerido" });
    if (!body?.profile)
      return json(400, { message: "profile requerido" });
    if (!isEmail(body?.email))
      return json(400, { message: "email inválido" });

    // Generar userId y timestamps en el backend
    const userId = randomUUID();
    const createdAt = new Date().toISOString();

    const item = {
      userId, // generado internamente
      organizationId: String(body.organizationId),
      profile: String(body.profile),
      email: String(body.email).toLowerCase(),
      status: body.status || "active",
      createdAt,
      updatedAt: createdAt,
      version: 1,
      metadata: body.metadata || {},
      ...(body.name ? { name: body.name } : {}),
    };

    // Insertar en DynamoDB, asegurando que no exista ya el userId
    await ddb.send(
      new PutCommand({
        TableName: TABLE,
        Item: item,
        ConditionExpression: "attribute_not_exists(userId)",
      })
    );

    return json(201, item);
  } catch (e: any) {
    if (e?.name === "ConditionalCheckFailedException") {
      return json(409, { message: "userId ya existe" });
    }
    console.error(e);
    return json(500, {
      message: "Error interno",
      error: e?.message || String(e),
    });
  }
};
