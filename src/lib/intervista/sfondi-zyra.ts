// Sfondi i zyrës prapa Artës (faqja e avatarit). Vizatuar nga ne për Karrierën, me dorë si SVG: pa asnjë figurë, foto ose
// material të huaj (docs/asetet.md). Disa KB, brenda faqes (pa rrjet, pa hot-link). Mjegullimi (thellësia e fushës) dhe
// varianti i errët bëhen me CSS te faqja. Mesi mbahet i qetë, që koka e Artës të dallohet qartë.
//
// Kujdes: pa backtick dhe pa "${": SVG-ja futet brenda String.raw të faqes.
export const SFONDI_I_ZYRES = [
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 280" preserveAspectRatio="xMidYMid slice">',
  "<defs>",
  '<linearGradient id="muri" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#EDE8E0"/><stop offset="1" stop-color="#D8D0C3"/></linearGradient>',
  '<linearGradient id="qielli" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#AFCFE6"/><stop offset="1" stop-color="#E8F0F4"/></linearGradient>',
  '<radialGradient id="drita" cx="0.5" cy="0.35" r="0.75"><stop offset="0.55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.22"/></radialGradient>',
  "</defs>",
  '<rect width="400" height="280" fill="url(#muri)"/>',
  // dritarja majtas, me pamje të largët
  '<rect x="18" y="26" width="128" height="150" rx="3" fill="#F8F6F2"/>',
  '<rect x="26" y="34" width="112" height="134" fill="url(#qielli)"/>',
  '<path d="M26 128h18v-22h16v30h14v-40h20v26h14v-14h18v28h12v32H26z" fill="#A7B7C2"/>',
  '<path d="M26 150h30v-14h22v18h26v-22h34v36H26z" fill="#8FA2AF"/>',
  '<rect x="80" y="34" width="4" height="134" fill="#F8F6F2"/>',
  '<rect x="26" y="96" width="112" height="4" fill="#F8F6F2"/>',
  '<rect x="12" y="176" width="140" height="7" rx="2" fill="#EFEBE4"/>',
  // rafti i librave djathtas
  '<rect x="272" y="22" width="116" height="214" rx="3" fill="#A98C6B"/>',
  '<rect x="279" y="29" width="102" height="200" fill="#8C7154"/>',
  '<g fill="#B39775"><rect x="279" y="76" width="102" height="6"/><rect x="279" y="128" width="102" height="6"/><rect x="279" y="180" width="102" height="6"/></g>',
  '<g><rect x="284" y="40" width="9" height="36" fill="#76879A"/><rect x="295" y="44" width="7" height="32" fill="#C7A984"/><rect x="304" y="38" width="11" height="38" fill="#8E9C7E"/><rect x="317" y="47" width="8" height="29" fill="#D9CDB5"/>',
  '<rect x="352" y="52" width="24" height="24" rx="12" fill="#D8C3A5"/>',
  '<rect x="286" y="96" width="30" height="32" rx="2" fill="#E4DCCB"/><rect x="322" y="90" width="8" height="38" fill="#B7847A"/><rect x="332" y="94" width="10" height="34" fill="#6F8196"/><rect x="344" y="98" width="7" height="30" fill="#C9B48E"/><rect x="353" y="92" width="9" height="36" fill="#879679"/>',
  '<rect x="284" y="146" width="8" height="34" fill="#C7A984"/><rect x="294" y="142" width="12" height="38" fill="#7B8C9C"/><rect x="308" y="150" width="7" height="30" fill="#B7847A"/><rect x="340" y="156" width="34" height="24" rx="2" fill="#A6B49A"/>',
  '<rect x="288" y="196" width="26" height="33" rx="2" fill="#D6C8AE"/><rect x="320" y="200" width="9" height="29" fill="#76879A"/><rect x="331" y="194" width="11" height="35" fill="#9AA78A"/></g>',
  // pikturë e vogël dhe llamba
  '<rect x="205" y="30" width="44" height="34" rx="2" fill="#F6F3EE"/><path d="M209 60l11-14 8 9 6-6 11 11z" fill="#9FB0A0"/><circle cx="238" cy="41" r="4" fill="#E2B987"/>',
  // bima poshtë majtas
  '<path d="M40 236h40l-6 44H46z" fill="#C7B297"/>',
  '<g fill="#6E8A66"><ellipse cx="52" cy="214" rx="9" ry="26" transform="rotate(-24 52 214)"/><ellipse cx="70" cy="210" rx="9" ry="28" transform="rotate(20 70 210)"/><ellipse cx="61" cy="205" rx="8" ry="30"/></g>',
  '<g fill="#819C76"><ellipse cx="44" cy="226" rx="7" ry="18" transform="rotate(-52 44 226)"/><ellipse cx="79" cy="224" rx="7" ry="19" transform="rotate(48 79 224)"/></g>',
  // tavolina larg dhe hija e butë anash
  '<rect x="0" y="252" width="400" height="28" fill="#B99E7E" opacity="0.55"/>',
  '<rect width="400" height="280" fill="url(#drita)"/>',
  "</svg>",
].join("");
