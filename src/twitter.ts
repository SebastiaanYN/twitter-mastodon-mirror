import { Client, auth } from "twitter-api-sdk";
import { TwitterResponse, usersIdTweets } from "twitter-api-sdk/dist/types";

import { Env } from ".";

export type Tweet = NonNullable<TwitterResponse<usersIdTweets>["data"]>[number];
export type Media = NonNullable<
  NonNullable<TwitterResponse<usersIdTweets>["includes"]>["media"]
>[number] & { url?: string; alt_text?: string };

export async function getTweets(
  env: Env,
  latest?: string
): Promise<TwitterResponse<usersIdTweets>> {
  const client = new Client(new auth.OAuth2Bearer(env.TWITTER_TOKEN));

  const tweets = await client.tweets.usersIdTweets(env.USER_ID, {
    exclude: ["replies"],
    since_id: latest,
    expansions: ["attachments.media_keys"],
    "media.fields": ["url", "alt_text"],
    "tweet.fields": ["conversation_id", "possibly_sensitive"],
  });

  return tweets;
}
