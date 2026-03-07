import Exa from "exa-js";

export const exaClient = new Exa(Bun.env.EXA_API_KEY);

export interface ExaResult {
  title: string;
  url: string;
  text: string;
}

export async function exaSearch(
  query: string,
  numResults: number = 5
): Promise<ExaResult[]> {
  const res = await exaClient.searchAndContents(query, {
    numResults,
    text: true,
  });
  res.results.map((r) => {
    console.log(r.title, r.url, r.text)
  })
  return res.results.map((r) => ({
    title: r.title ?? "",
    url: r.url,
    text: r.text ?? "",
  }));
}
