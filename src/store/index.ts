import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

export interface FeedItem {
  title: string;
  type: string;
  text: string;
  author: string;
  authorAvatar: string;
  image: string;
}

export interface State {
  homeItems: FeedItem[];
}

const Store = create<State>()(
  subscribeWithSelector(() => ({
    homeItems: [
      {
        title: 'Welcome to Nexus',
        type: 'Blog',
        text: 'This is a sample feed item to get you started.',
        author: 'Nexus Team',
        authorAvatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?q=80&w=150&auto=format&fit=crop',
        image: 'https://images.unsplash.com/photo-1520927640400-f9e83b1bc43a?q=80&w=800&auto=format&fit=crop',
      },
      {
        title: 'Getting Started',
        type: 'Tutorial',
        text: 'Learn how to use Nexus with this quick tutorial.',
        author: 'Nexus Team',
        authorAvatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=150&auto=format&fit=crop',
        image: 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?q=80&w=800&auto=format&fit=crop',
      },
    ],
  }))
);

export default Store; 