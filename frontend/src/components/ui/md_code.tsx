function MarkdownCode({ text }: { text: string }) {
  return (
    <>
      <code className="bg-muted rounded px-1 py-0.5 text-xs">{text}</code>
    </>
  );
}

export default MarkdownCode;
