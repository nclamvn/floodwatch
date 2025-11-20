#!/usr/bin/env bash
#
# FloodWatch - Export Helpcard to PDF
#
# This script exports HELPCARD_PUBLIC.md to PDF with Vietnamese and emoji support
#
# Requirements (choose one):
#   Option 1: pandoc + xelatex (basic, no emojis)
#   Option 2: pandoc + wkhtmltopdf (better formatting)
#   Option 3: Browser print (best, manual)
#
# Usage:
#   ./export_helpcard_pdf.sh [option]
#
#   option 1 = xelatex (default)
#   option 2 = wkhtmltopdf
#   option 3 = generate HTML for browser print
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INPUT="$SCRIPT_DIR/HELPCARD_PUBLIC.md"
OUTPUT_PDF="$SCRIPT_DIR/HELPCARD_PUBLIC.pdf"
OUTPUT_HTML="$SCRIPT_DIR/HELPCARD_PUBLIC_print.html"

METHOD="${1:-1}"

echo "========================================"
echo "FloodWatch Helpcard PDF Export"
echo "========================================"
echo ""

case $METHOD in
  1)
    echo "Method 1: Using pandoc + xelatex (basic)"
    echo "Note: Emojis will be missing but text is readable"
    echo ""

    if ! command -v pandoc &> /dev/null; then
      echo "❌ pandoc not found. Install: brew install pandoc"
      exit 1
    fi

    pandoc "$INPUT" -o "$OUTPUT_PDF" \
      --pdf-engine=xelatex \
      --metadata title="FloodWatch - Hướng dẫn sử dụng nhanh" \
      -V geometry:margin=0.75in \
      -V fontsize=10pt \
      -V papersize=a4 \
      -V mainfont="Arial" 2>&1 | grep -v "Missing character" || true

    echo "✅ PDF created: $OUTPUT_PDF"
    echo "   Size: $(ls -lh "$OUTPUT_PDF" | awk '{print $5}')"
    ;;

  2)
    echo "Method 2: Using pandoc + wkhtmltopdf (better formatting)"
    echo ""

    if ! command -v pandoc &> /dev/null; then
      echo "❌ pandoc not found. Install: brew install pandoc"
      exit 1
    fi

    if ! command -v wkhtmltopdf &> /dev/null; then
      echo "❌ wkhtmltopdf not found. Install: brew install --cask wkhtmltopdf"
      exit 1
    fi

    pandoc "$INPUT" -o "$OUTPUT_PDF" \
      --pdf-engine=wkhtmltopdf \
      --metadata title="FloodWatch - Hướng dẫn sử dụng nhanh" \
      -V margin-top=20mm \
      -V margin-bottom=20mm \
      -V margin-left=20mm \
      -V margin-right=20mm

    echo "✅ PDF created: $OUTPUT_PDF"
    echo "   Size: $(ls -lh "$OUTPUT_PDF" | awk '{print $5}')"
    ;;

  3)
    echo "Method 3: Generate HTML for browser print (BEST quality)"
    echo ""

    if ! command -v pandoc &> /dev/null; then
      echo "❌ pandoc not found. Install: brew install pandoc"
      exit 1
    fi

    # Generate standalone HTML with embedded CSS
    pandoc "$INPUT" -o "$OUTPUT_HTML" \
      --standalone \
      --metadata title="FloodWatch - Hướng dẫn sử dụng nhanh" \
      --css=<(cat <<'EOF'
body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  max-width: 800px;
  margin: 40px auto;
  padding: 20px;
  line-height: 1.6;
  color: #333;
}

h1, h2, h3 {
  color: #2c3e50;
  margin-top: 1.5em;
}

h1 {
  border-bottom: 3px solid #3498db;
  padding-bottom: 10px;
}

h2 {
  border-bottom: 2px solid #95a5a6;
  padding-bottom: 8px;
}

code {
  background: #f4f4f4;
  padding: 2px 6px;
  border-radius: 3px;
  font-family: "Monaco", "Courier New", monospace;
  font-size: 0.9em;
}

pre {
  background: #2c3e50;
  color: #ecf0f1;
  padding: 15px;
  border-radius: 5px;
  overflow-x: auto;
}

pre code {
  background: transparent;
  color: inherit;
}

table {
  border-collapse: collapse;
  width: 100%;
  margin: 20px 0;
}

th, td {
  border: 1px solid #ddd;
  padding: 12px;
  text-align: left;
}

th {
  background: #3498db;
  color: white;
}

tr:nth-child(even) {
  background: #f9f9f9;
}

blockquote {
  border-left: 4px solid #3498db;
  padding-left: 20px;
  margin-left: 0;
  font-style: italic;
  color: #555;
}

ul, ol {
  margin: 15px 0;
  padding-left: 30px;
}

li {
  margin: 8px 0;
}

@media print {
  body {
    max-width: 100%;
    margin: 0;
    padding: 10mm;
  }

  h1, h2, h3 {
    page-break-after: avoid;
  }

  table, pre, blockquote {
    page-break-inside: avoid;
  }

  @page {
    margin: 15mm;
  }
}
EOF
    )

    echo "✅ HTML created: $OUTPUT_HTML"
    echo ""
    echo "📄 To create PDF:"
    echo "   1. Open $OUTPUT_HTML in your browser"
    echo "   2. Press Cmd+P (Mac) or Ctrl+P (Windows)"
    echo "   3. Select 'Save as PDF'"
    echo "   4. Adjust margins to 'Default' or 'Minimum'"
    echo "   5. Save as: HELPCARD_PUBLIC.pdf"
    echo ""
    echo "   This method preserves emojis and Vietnamese characters perfectly!"
    ;;

  *)
    echo "❌ Invalid option: $METHOD"
    echo ""
    echo "Usage: $0 [1|2|3]"
    echo "  1 = xelatex (basic, no emoji)"
    echo "  2 = wkhtmltopdf (better)"
    echo "  3 = HTML for browser print (BEST)"
    exit 1
    ;;
esac

echo ""
echo "========================================"
echo "Export complete!"
echo "========================================"
