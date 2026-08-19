import { publicCommunicationCapabilities } from "../../server/communications/config.js";
import { json, methodNotAllowed } from "../../server/communications/http.js";

export async function GET() {
  return json(publicCommunicationCapabilities(), 200, {
    "cache-control": "private, max-age=60",
  });
}

export function POST() {
  return methodNotAllowed("GET");
}
