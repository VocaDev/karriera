// Shpalljet e punës që tregon lista. Më vonë vijnë nga Supabase (crawler-i i portaleve).
// Mbajeni `id`: është çelësi i listës dhe parametri i ekranit të detajeve (/pune/[id]).
export type Puna = {
  id: string;
  titulli: string;
  kompania: string;
  qyteti: string;
  roli: "SWE" | "Asistent/PR";
  pershkrimi: string;
  aftesite: string[];
};

// Të dhëna të sajuara: kompanitë nuk janë reale.
export const punet: Puna[] = [
  {
    id: "p1",
    titulli: "Junior React Native Developer",
    kompania: "Dardania Soft",
    qyteti: "Prishtinë",
    roli: "SWE",
    pershkrimi: "Zhvillim i aplikacioneve mobile për klientë në Gjermani. Mentorim nga një senior.",
    aftesite: ["React Native", "TypeScript", "Git"],
  },
  {
    id: "p2",
    titulli: "Praktikant Backend (Node.js)",
    kompania: "Ibri Tech",
    qyteti: "Mitrovicë",
    roli: "SWE",
    pershkrimi: "Praktikë 3-mujore me pagesë. API dhe baza të dhënash për një platformë logjistike.",
    aftesite: ["Node.js", "SQL", "REST API"],
  },
  {
    id: "p3",
    titulli: "Frontend Developer (remote)",
    kompania: "Kodi Studio",
    qyteti: "Remote",
    roli: "SWE",
    pershkrimi: "Ueb-faqe dhe dashboard-e në Next.js. Takime në anglisht.",
    aftesite: ["React", "Next.js", "CSS"],
  },
  {
    id: "p4",
    titulli: "Asistent/e Administrative",
    kompania: "Rugova Group",
    qyteti: "Pejë",
    roli: "Asistent/PR",
    pershkrimi: "Organizim i takimeve, korrespondencë me klientët, arkivim i dokumenteve.",
    aftesite: ["Komunikim", "Excel", "Anglisht"],
  },
  {
    id: "p5",
    titulli: "Koordinator/e PR dhe Rrjete Sociale",
    kompania: "Agjencia Iliria",
    qyteti: "Prishtinë",
    roli: "Asistent/PR",
    pershkrimi: "Postime për rrjetet sociale, komunikata për media, raporte mujore.",
    aftesite: ["Shkrim", "Canva", "Instagram"],
  },
  {
    id: "p6",
    titulli: "Asistent/e në Shërbimin ndaj Klientit",
    kompania: "Sharri Telecom",
    qyteti: "Prizren",
    roli: "Asistent/PR",
    pershkrimi: "Përgjigje klientëve me telefon dhe email në shqip dhe gjermanisht.",
    aftesite: ["Gjermanisht", "Durim", "Komunikim"],
  },
];

export function gjePunen(id: string): Puna | undefined {
  return punet.find((p) => p.id === id);
}
