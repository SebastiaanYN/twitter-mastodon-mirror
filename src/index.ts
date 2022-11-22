import { getTweets, Media } from "./twitter";
import { postMastodonStatus } from "./mastodon";

export interface Env {
  USER_ID: string;
  MASTODON_URL: string;

  TWITTER_TOKEN: string;
  MASTODON_TOKEN: string;

  TWEETS: KVNamespace;
}

const TWEET_ID_MAP_TTL = 60 * 60 * 24 * 7;

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
        expirationTtl: TWEET_ID_MAP_TTL,
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
