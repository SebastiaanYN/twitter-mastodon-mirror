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

async function getTweets(env: Env, latest?: string): Promise<Tweet[]> {
  const client = new Client(new auth.OAuth2Bearer(env.TWITTER_TOKEN));
  const tweets = await client.tweets.usersIdTweets(env.USER_ID, {
    exclude: ["replies"],
    since_id: latest,
    "tweet.fields": ["conversation_id"],
  });

  return tweets.data || [];
}

async function postMastodonStatus(env: Env, tweet: Tweet): Promise<any> {
  const replyId = tweet.conversation_id
    ? await env.TWEETS.get(`tweet-${tweet.conversation_id}`)
    : null;

  const post: any = await fetch(`https://${env.MASTODON_URL}/api/v1/statuses`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.MASTODON_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      status: tweet.text,
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
    const tweets = await getTweets(env, latest);

    console.log(`Loaded ${tweets.length} tweets`);

    for (let i = tweets.length - 1; i >= 0; i--) {
      const tweet = tweets[i];
      console.log(`Posting tweet: ${tweet.id}`, JSON.stringify(tweet));

      const post = await postMastodonStatus(env, tweet);
      await env.TWEETS.put(`tweet-${tweet.id}`, post.id, {
        expirationTtl: TWEET_ID_TTL,
      });

      console.log(`Posted to mastodon: ${post.id}`, JSON.stringify(post));
    }

    if (tweets.length >= 1) {
      await env.TWEETS.put("latest", tweets[0].id);
    }
  },
};
