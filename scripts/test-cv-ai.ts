import process from "node:process";
import {
  AnalizaCVSchema,
  CvStrukturuarSchema,
  gjeneroJSON,
} from "../supabase/functions/_shared/cv-ai.ts";

const apiKey = process.env.ANTHROPIC_API_KEY;

if (!apiKey) {
  throw new Error("Vendos ANTHROPIC_API_KEY para ekzekutimit.");
}

Deno.env.set("ANTHROPIC_API_KEY", apiKey);

const pdfPath = Deno.args[0];

if (!pdfPath) {
  throw new Error("Përdorimi: deno run ... scripts/test-cv-ai.ts <rruga-e-pdf>");
}

const bytes = await Deno.readFile(pdfPath);

if (bytes.length > 5 * 1024 * 1024) {
  throw new Error("PDF-ja duhet të jetë maksimumi 5 MB.");
}

if (new TextDecoder().decode(bytes.subarray(0, 5)) !== "%PDF-") {
  throw new Error("Skedari nuk është PDF i vlefshëm.");
}

function neBase64(data: Uint8Array): string {
  let binary = "";

  for (let i = 0; i < data.length; i += 0x8000) {
    binary += String.fromCharCode(...data.subarray(i, i + 0x8000));
  }

  return btoa(binary);
}

console.log("1/2 - Duke testuar krijimin e CV-së...");

const cv = await gjeneroJSON(
  CvStrukturuarSchema,
  `You are a professional CV writer.
Never invent facts. Return all text in Albanian.
Use only the supplied information.`,
  `Create a structured CV using these facts:
  Name: Test Kandidati
  Title: Junior Software Developer
  City: Prishtinë
  Email: test@example.com
  Education: Computer Science student
  Skills: JavaScript, TypeScript, React Native
  Language: Albanian, native
  Language: English, B2

  Do not invent any other personal information.`,
  6000,
);

console.log("CV creation: PASSED");
console.log(`Generated title: ${cv.titulli || "Not provided"}`);

console.log("2/2 - Duke testuar analizën e PDF-së...");

const analiza = await gjeneroJSON(
  AnalizaCVSchema,
  `You are a fair CV reviewer familiar with Kosovo and European job markets.
Return all feedback in Albanian.
Never invent facts. Be specific and constructive.
The roast must be humorous, respectful and contain no personal data.`,
  [
    {
      type: "document",
      source: {
        type: "base64",
        media_type: "application/pdf",
        data: neBase64(bytes),
      },
    },
    {
      type: "text",
      text: "Analyze this CV and return a structured review.",
    },
  ],
  4096,
);

console.log("CV review: PASSED");
console.log(`Score: ${analiza.nota}/100`);
console.log("All AI schema tests passed.");
