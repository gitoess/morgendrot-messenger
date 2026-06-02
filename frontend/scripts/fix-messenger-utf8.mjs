import fs from 'fs'

const path = 'frontend/components/messenger-dashboard.tsx'
let s = fs.readFileSync(path, 'utf8')

const fixes = [
  ['â€"', '—'],
  ['â€“', '–'],
  ['â†\'', '→'],
  ['â€ž', '„'],
  ['â€œ', '"'],
  ['ZurÃ¼ck', 'Zurück'],
  ['SchlieÃŸen', 'Schließen'],
  ['Ã—', '×'],
  ['Â·', '·'],
  ['Ã¼ber', 'über'],
  ['KurzÃ¼berblick', 'Kurzüberblick'],
  ['Ã¶ffnen', 'öffnen'],
  ['OberflÃ¤chen', 'Oberflächen'],
  ['mÃ¶chtest', 'möchtest'],
  ['WÃ¤hle', 'Wähle'],
  ['ausfÃ¼hren', 'ausführen'],
  ['Morgendrot Messenger â€"', 'Morgendrot Messenger —'],
]

for (const [from, to] of fixes) {
  s = s.split(from).join(to)
}

fs.writeFileSync(path, s, 'utf8')
console.log('fixed utf8')
