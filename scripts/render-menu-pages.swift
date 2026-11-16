// Renders the print menu PDF into page images and dumps its text layout.
//
//   swift scripts/render-menu-pages.swift <menu.pdf> public/images/menu scripts/menu-text.json
//   node scripts/build-menu-catalog.mjs
//
// The second step turns the text layout into src/lib/menu/catalog.data.ts (dish ids,
// prices, options and tap areas). Coordinates are PDF points with a top-left origin,
// matching the 612 × 1008 page units used by MenuCanvas.
import PDFKit
import AppKit

let args = CommandLine.arguments
guard args.count >= 3, let doc = PDFDocument(url: URL(fileURLWithPath: args[1])) else {
  print("usage: render-menu-pages.swift <menu.pdf> <image-dir> [text-layout.json]")
  exit(1)
}
let outDir = args[2]
let scale: CGFloat = 2.5

struct Run: Encodable { let page: Int; let x: Double; let y: Double; let w: Double; let h: Double; let bold: Bool; let size: Double; let text: String }
var runs: [Run] = []

for i in 0..<doc.pageCount {
  let page = doc.page(at: i)!
  let b = page.bounds(for: .mediaBox)
  let w = Int(b.width * scale), h = Int(b.height * scale)
  let rep = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: w, pixelsHigh: h, bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)!
  let ctx = NSGraphicsContext(bitmapImageRep: rep)!
  NSGraphicsContext.current = ctx
  let cg = ctx.cgContext
  cg.setFillColor(NSColor.white.cgColor); cg.fill(CGRect(x: 0, y: 0, width: w, height: h))
  cg.scaleBy(x: scale, y: scale)
  page.draw(with: .mediaBox, to: cg)
  let data = rep.representation(using: .jpeg, properties: [.compressionFactor: 0.82])!
  try! data.write(to: URL(fileURLWithPath: "\(outDir)/page-\(i + 1).jpg"))
  print("page \(i + 1): \(w)×\(h)")

  // Text runs: split every text line wherever the font changes.
  guard args.count >= 4, let attr = page.attributedString else { continue }
  let full = attr.string as NSString
  var loc = 0
  while loc < full.length {
    let line = full.lineRange(for: NSRange(location: loc, length: 0))
    loc = NSMaxRange(line)
    attr.enumerateAttribute(.font, in: line) { value, range, _ in
      let text = full.substring(with: range).trimmingCharacters(in: .whitespacesAndNewlines)
      guard !text.isEmpty, let font = value as? NSFont, let sel = page.selection(for: range) else { return }
      let r = sel.bounds(for: page)
      runs.append(Run(page: i + 1, x: Double(r.minX), y: Double(b.height - r.maxY), w: Double(r.width), h: Double(r.height),
                      bold: font.fontName.contains("Bold"), size: Double(font.pointSize), text: text))
    }
  }
}

if args.count >= 4 {
  let enc = JSONEncoder()
  enc.outputFormatting = [.prettyPrinted, .sortedKeys]
  try! enc.encode(runs).write(to: URL(fileURLWithPath: args[3]))
  print("text runs: \(runs.count)")
}
