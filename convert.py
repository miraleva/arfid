from markitdown import MarkItDown

md = MarkItDown()
result = md.convert("books/The Tastiest High Protein Recipes for Kids_ Delight Your -- Ray, Valeria.pdf")
print(result.text_content)

with open("markitdown_output/The Tastiest High Protein Recipes for Kids_ Delight Your -- Ray, Valeria.md", "w", encoding="utf-8") as f:
    f.write(result.text_content)