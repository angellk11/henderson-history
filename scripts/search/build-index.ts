import MiniSearch from "minisearch";
import fs from "node:fs/promises";
import path from "node:path";

import { toSearchItems } from "./toSearchItems";
// import type { SearchConfig } from "./types";
import type { SearchItem, IndexedDoc } from "../../src/lib/types";
import { allConfigs, type SearchableSet } from "./configs";
import type { Person } from "./configs/person";
import type { Org } from "./configs/org";
import type { Building } from "./configs/building";

async function readJSON<T>(relativePath: string): Promise<T> {
    const absolute = path.resolve(process.cwd(), relativePath);
    return JSON.parse(await fs.readFile(absolute, "utf-8")) as T;
}

async function loadData(): Promise<
    Pick<SearchableSet, "people" | "orgs" | "buildings">
> {
    return {
        people: await readJSON<Person[]>("data/build/people.json"),
        orgs: await readJSON<Org[]>("data/build/orgs.json"),
        buildings: await readJSON<Building[]>("data/build/buildings.json"),
    };
}

async function main() {
    const data = await loadData();

    const items: SearchItem[] = [
        ...toSearchItems(data.people, allConfigs.people),
        ...toSearchItems(data.orgs, allConfigs.orgs),
        ...toSearchItems(data.buildings, allConfigs.buildings),
    ];

    const typeCounts: Record<string, number> = {};
    for (const item of items) {
        typeCounts[item.type] = (typeCounts[item.type] || 0) + 1;
    }
    console.log("Indexing by type:", typeCounts);

    const docs: IndexedDoc[] = items.map((item, i) => ({
        id: i,
        type: item.type,
        slug: item.slug,
        title: item.title,
        subtitle: item.subtitle,
        year: item.year,
    }));

    const miniSearch = new MiniSearch<IndexedDoc>({
        fields: ["title", "subtitle", "tokens"],
        storeFields: ["type", "slug", "title", "subtitle", "year"],
        searchOptions: {
            boost: { title: 3, subtitle: 1.5 },
            fuzzy: 0.2,
            prefix: true,
        },
    });

    miniSearch.addAll(docs);

    const outputDir = path.resolve(process.cwd(), "public/search");
    await fs.mkdir(outputDir, { recursive: true });

    const serialized = JSON.stringify(miniSearch);
    await fs.writeFile(path.join(outputDir, "index.json"), serialized);

    console.log(
        "Search index built:",
        `${docs.length} docs, ${Math.round(serialized.length / 1024)} KB`,
    );
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
