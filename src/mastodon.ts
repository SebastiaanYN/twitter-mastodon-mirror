import { Env } from ".";
import { Media, Tweet } from "./twitter";
import { unescapeString } from "./utils";

async function uploadMedia(
  env: Env,
  mediaKeys: string[],
  media: Media[]
): Promise<string[]> {
  const promises = [];
  const mediaIds: string[] = [];

  for (const key of mediaKeys) {
    const item = media.find((m) => m.media_key === key);

    if (item?.media_key && item?.url) {
      const promise = fetch(item.url)
        .then((res) => res.blob())
        .then((blob) => {
          console.log(`Fetched media ${item.url}`);

          const formData = new FormData();
          formData.append("file", blob);

          if (item.alt_text) {
            formData.append("description", item.alt_text);
          }

          return fetch(`https://${env.MASTODON_URL}/api/v2/media`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${env.MASTODON_TOKEN}`,
            },
            body: formData,
          });
        })
        .then((res) => res.json())
        .then((json: any) => {
          console.log(`Uploaded media: ${json.url}`);
          mediaIds.push(json.id);
        });

      promises.push(promise);
    }
  }

  await Promise.all(promises);
  return mediaIds;
}

export async function postMastodonStatus(
  env: Env,
  tweet: Tweet,
  media: Media[]
): Promise<any> {
  const replyId =
    tweet.conversation_id && tweet.conversation_id !== tweet.id
      ? await env.TWEETS.get(`tweet-${tweet.conversation_id}`)
      : null;

  // Since we want to mirror the attachements from tweets we have to upload them
  // and then add the media ID returned by Mastodon to the status update
  const mediaIds = await uploadMedia(
    env,
    tweet.attachments?.media_keys || [],
    media
  );

  const post: any = await fetch(`https://${env.MASTODON_URL}/api/v1/statuses`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.MASTODON_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      status: unescapeString(tweet.text), // tweets keep escape codes
      media_ids: mediaIds,
      in_reply_to_id: replyId,
    }),
  }).then((res) => res.json());

  return post;
}
