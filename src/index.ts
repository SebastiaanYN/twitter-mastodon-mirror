import { Client, auth } from "twitter-api-sdk";
import { TwitterResponse, usersIdTweets } from "twitter-api-sdk/dist/types";

export interface Env {
  USER_ID: string;
  MASTODON_URL: string;

  TWITTER_TOKEN: string;
  MASTODON_TOKEN: string;

  TWEETS: KVNamespace;
}

const TWEET_ID_TTL = 60 * 60 * 24 * 7;

type Tweet = NonNullable<TwitterResponse<usersIdTweets>["data"]>[number];
type Media = NonNullable<
  NonNullable<TwitterResponse<usersIdTweets>["includes"]>["media"]
>[number] & { url?: string; alt_text?: string };

function unescapeString(s: string): string {
  return s
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'");
}

async function getTweets(
  env: Env,
  latest?: string
): Promise<TwitterResponse<usersIdTweets>> {
  const client = new Client(new auth.OAuth2Bearer(env.TWITTER_TOKEN));

  const tweets = await client.tweets.usersIdTweets(env.USER_ID, {
    exclude: ["replies"],
    since_id: latest,
    expansions: ["attachments.media_keys"],
    "media.fields": ["url", "alt_text"],
    "tweet.fields": ["conversation_id"],
  });

  return tweets;
}

async function uploadMedia(
  env: Env,
  mediaKeys: string[],
  media: Media[]
): Promise<string[]> {
  const promises = [];
  const mediaIds: string[] = [];

  for (const key of mediaKeys) {
    const item = media.find((m) => m.media_key === key);
    console.log(key, media);

    if (item?.media_key && item?.url) {
      const promise = fetch(item.url)
        .then((res) => res.blob())
        .then(async (blob) => {
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

async function postMastodonStatus(
  env: Env,
  tweet: Tweet,
  media: Media[]
): Promise<any> {
  const replyId =
    tweet.conversation_id && tweet.conversation_id !== tweet.id
      ? await env.TWEETS.get(`tweet-${tweet.conversation_id}`)
      : null;

  const mediaKeys = tweet.attachments?.media_keys || [];
  const mediaIds = await uploadMedia(env, mediaKeys, media);

  const post: any = await fetch(`https://${env.MASTODON_URL}/api/v1/statuses`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.MASTODON_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      status: unescapeString(tweet.text),
      media_ids: mediaIds,
      in_reply_to_id: replyId,
    }),
  }).then((res) => res.json());

  return post;
}

export default {
  async fetch() {
    return new Response();
  },
  async scheduled(
    controller: ScheduledController,
    env: Env,
    ctx: ExecutionContext
  ): Promise<void> {
    const latest = (await env.TWEETS.get("latest")) || undefined;
    const tweetData = await getTweets(env, latest);

    const tweets = tweetData.data || [];
    const media = tweetData.includes?.media as Media[];

    console.log(`Loaded ${tweets.length} tweets`);

    for (let i = tweets.length - 1; i >= 0; i--) {
      const tweet = tweets[i];
      console.log(`Posting tweet: ${tweet.id}`);

      const post = await postMastodonStatus(env, tweet, media);
      await env.TWEETS.put(`tweet-${tweet.id}`, post.id, {
        expirationTtl: TWEET_ID_TTL,
      });

      console.log(`Posted to mastodon: ${post.id}`);
      console.log();
    }

    if (tweets.length >= 1) {
      await env.TWEETS.put("latest", tweets[0].id);
    }
    console.log();
  },
};
