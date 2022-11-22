import { Client, auth } from "twitter-api-sdk";
import {
  findUserById,
  TwitterResponse,
  usersIdTweets,
} from "twitter-api-sdk/dist/types";

import { Env } from ".";

export type User = NonNullable<TwitterResponse<findUserById>["data"]>;
export type Tweet = NonNullable<TwitterResponse<usersIdTweets>["data"]>[number];
export type Media = NonNullable<
  NonNullable<TwitterResponse<usersIdTweets>["includes"]>["media"]
>[number] & { url?: string; alt_text?: string };

function getClient(env: Env): Client {
  return new Client(new auth.OAuth2Bearer(env.TWITTER_TOKEN));
}
export async function getTweets(
  env: Env,
  latest?: string
): Promise<TwitterResponse<usersIdTweets>> {
  const client = getClient(env);

  const tweets = await client.tweets.usersIdTweets(env.USER_ID, {
    exclude: ["replies"],
    since_id: latest,
    expansions: ["attachments.media_keys"],
    "media.fields": ["url", "alt_text"],
    "tweet.fields": ["conversation_id", "possibly_sensitive"],
  });

  return tweets;
}

export async function getUser(
  env: Env
): Promise<TwitterResponse<findUserById>> {
  const client = getClient(env);

  const user = await client.users.findUserById(env.USER_ID, {
    "user.fields": [
      "name",
      "username",
      "description",
      "profile_image_url",
      "pinned_tweet_id",
    ],
  });

  return user;
}
