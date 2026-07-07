public sealed class X12Reader
{
    private readonly char _segTerm;
    private readonly char _elemSep;

    public X12Reader(string rawDocument)
    {
        _elemSep = rawDocument[3];
        _segTerm = rawDocument[105];
    }

    public IEnumerable<Segment> Read(string rawDocument)
    {
        foreach (var raw in rawDocument.Split(_segTerm,
                     StringSplitOptions.RemoveEmptyEntries))
        {
            var elements = raw.Split(_elemSep);
            yield return new Segment(elements[0], elements[1..]);
        }
    }
}

public readonly record struct Segment(string Id, string[] Elements)
{
    public string this[int i] => i < Elements.Length ? Elements[i] : string.Empty;
}
