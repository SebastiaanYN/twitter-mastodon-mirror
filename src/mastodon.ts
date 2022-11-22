import { Env } from ".";
import { Media, Tweet, User } from "./twitter";
import { expandEntities, unescapeString } from "./utils";

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

  let status = tweet.text;
  if (tweet.entities) {
    status = expandEntities(status, tweet.entities, tweet.attachments);
  }
  status = unescapeString(status); // tweets keep escape codes

  const post: any = await fetch(`https://${env.MASTODON_URL}/api/v1/statuses`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.MASTODON_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      status,
      media_ids: mediaIds,
      in_reply_to_id: replyId,
      sensitive: tweet.possibly_sensitive,
    }),
  }).then((res) => res.json());

  return post;
}

async function pinStatus(env: Env, tweetId: string): Promise<void> {
  const id = await env.TWEETS.get(`tweet-${tweetId}`);

  if (id) {
    console.log(`Pinning tweet: ${tweetId}`);
    await fetch(`https://${env.MASTODON_URL}/api/v1/statuses/${id}/pin`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.MASTODON_TOKEN}`,
      },
    });
    console.log(`Pinned: ${id}`);
  } else {
    console.log(`Tweet ${tweetId} is not mirrored`);
  }
}

export async function updateProfile(env: Env, user: User): Promise<any> {
  if (user.pinned_tweet_id) {
    await pinStatus(env, user.pinned_tweet_id);
  }

  const formData = new FormData();

  if (user.profile_image_url) {
    // For some reason Twitter runs a link that's very low quality, so the _normal at the end needs to be removed
    const profileImageUrl = user.profile_image_url.replace("_normal.", ".");
    console.log(`Fetching profile image: ${profileImageUrl}`);

    const avatar = await fetch(profileImageUrl).then((res) => res.blob());
    formData.append("avatar", avatar);
  }

  formData.append("bot", "true");
  formData.append("display_name", user.name);

  let description = `mirror of https://twitter.com/${user.username}`;
  if (user.description && user.entities?.description) {
    description += " - ";
    description += expandEntities(user.description, user.entities.description);
  }
  description = unescapeString(description);
  formData.append("note", description);

  console.log("Updating profile");
  const res: any = await fetch(
    `https://${env.MASTODON_URL}/api/v1/accounts/update_credentials`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${env.MASTODON_TOKEN}`,
      },
      body: formData,
    }
  ).then((res) => res.text());

  return res;
}
