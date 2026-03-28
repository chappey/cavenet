import PostCard from "./PostCard";

export default function FeedPage({ posts, setPosts }) {
  return (
    <div>
      <h2>🔥 Tribe Feed</h2>

      {posts.map((post, index) => (
        <PostCard
          key={index}
          post={post}
          index={index}
          posts={posts}
          setPosts={setPosts}
        />
      ))}
    </div>
  );
}