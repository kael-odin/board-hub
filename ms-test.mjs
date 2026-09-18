import * as XLSX from 'xlsx'
import fs from 'node:fs'

const buf = fs.readFileSync('public/boards/multisheet-test.xlsx')
const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
const wb = XLSX.read(ab, { type: 'array', cellDates: true, cellFormula: true })

console.log('读到的工作表数:', wb.SheetNames.length)
console.log('工作表名:', wb.SheetNames.join(' / '))
for (const name of wb.SheetNames) {
  const ws = wb.Sheets[name]
  const range = XLSX.utils.decode_range(ws['!ref'])
  const a1 = ws['A1']?.v, b2 = ws['B2']?.v
  console.log(`  ${name}: ${range.e.r + 1} 行 x ${range.e.c + 1} 列  A1=${a1} B2=${b2}`)
}
