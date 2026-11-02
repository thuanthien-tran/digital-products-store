import fs from "fs"
import path from "path"

function getDirStats(dirPath: string): { bytes: number; count: number } {
  let bytes = 0
  let count = 0

  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name)
      if (entry.isDirectory()) {
        const sub = getDirStats(fullPath)
        bytes += sub.bytes
        count += sub.count
      } else if (entry.isFile()) {
        bytes += fs.statSync(fullPath).size
        count++
      }
    }
  } catch (err) {
    // skip permissions errors
  }

  return { bytes, count }
}

const root = process.cwd()
const entries = fs.readdirSync(root, { withFileTypes: true })

console.log("=== PROJECT SIZE MEASUREMENT ===")
let totalBytes = 0
let totalFiles = 0

for (const entry of entries) {
  const fullPath = path.join(root, entry.name)
  if (entry.isDirectory()) {
    const stats = getDirStats(fullPath)
    totalBytes += stats.bytes
    totalFiles += stats.count
    console.log(
      `${entry.name.padEnd(25)}: ${(stats.bytes / (1024 * 1024)).toFixed(3).padStart(10)} MB (${stats.count.toString().padStart(6)} files)`
    )
  } else if (entry.isFile()) {
    const size = fs.statSync(fullPath).size
    totalBytes += size
    totalFiles++
  }
}

console.log("-----------------------------------------------------------------")
console.log(`TOTAL LOGICAL SIZE: ${(totalBytes / (1024 * 1024)).toFixed(3)} MB in ${totalFiles} files\n`)
