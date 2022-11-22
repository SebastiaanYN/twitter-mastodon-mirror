import { Attachments, Entities } from "./twitter";

export function unescapeString(s: string): string {
  return s
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'");
}

function replaceUrl(
  [s, offset]: [string, number],
  entity: NonNullable<Entities["urls"]>[number],
  attachments?: Attachments
): [string, number] {
  const url = entity.expanded_url;

  if (url) {
    const start = s.substring(0, entity.start + offset);
    const end = s.substring(entity.end + offset);
    const charsRemoved = entity.end - entity.start;

    if (
      entity.media_key &&
      attachments?.media_keys?.includes(entity.media_key)
    ) {
      // skip media links as they're added as attachments
      return [start + end, offset - charsRemoved];
    } else {
      return [start + url + end, offset - charsRemoved + url.length];
    }
  }

  return [s, offset];
}

function replaceMention(
  [s, offset]: [string, number],
  entity: NonNullable<Entities["mentions"]>[number]
): [string, number] {
  const start = s.substring(0, entity.start + offset);
  const end = s.substring(entity.end + offset);
  const charsRemoved = entity.end - entity.start;
  const name = `https://twitter.com/${entity.username}`;

  return [start + name + end, offset - charsRemoved + name.length];
}

export function expandEntities(
  s: string,
  entities: Entities,
  attachments?: Attachments
): string {
  let offset = 0;
  let urlIndex = 0;
  let mentionIndex = 0;

  const urls = entities.urls || [];
  const mentions = entities.mentions || [];

  while (urlIndex < urls.length && mentionIndex < mentions.length) {
    if (urls[urlIndex].start < mentions[mentionIndex].start) {
      [s, offset] = replaceUrl([s, offset], urls[urlIndex], attachments);
      urlIndex++;
    } else {
      [s, offset] = replaceMention([s, offset], mentions[mentionIndex]);
      mentionIndex++;
    }
  }

  while (urlIndex < urls.length) {
    [s, offset] = replaceUrl([s, offset], urls[urlIndex], attachments);
    urlIndex++;
  }

  while (mentionIndex < mentions.length) {
    [s, offset] = replaceMention([s, offset], mentions[mentionIndex]);
    mentionIndex++;
  }

  return s;
}
