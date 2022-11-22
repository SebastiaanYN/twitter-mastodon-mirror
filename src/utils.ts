import { Attachments, Entities } from "./twitter";

export function unescapeString(s: string): string {
  return s
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'");
}

export function expandEntities(
  s: string,
  entities: Entities,
  attachments?: Attachments
): string {
  for (const entity of entities.urls || []) {
    if (entity.expanded_url) {
      if (
        entity.media_key &&
        attachments?.media_keys?.includes(entity.media_key)
      ) {
        // remove links that are attachements
        s = s.replace(entity.url, "");
      } else {
        s = s.replace(entity.url, entity.expanded_url);
      }
    }
  }

  for (const entity of entities.mentions || []) {
    s = s.replace(
      `@${entity.username}`,
      `https://twitter.com/${entity.username}`
    );
  }

  return s;
}
