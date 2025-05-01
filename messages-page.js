import { defineAsyncComponent } from "vue";
import { NavBar }                from "./nav-bar.js";
import { DirectMessageSidebar }  from "./direct-message-sidebar.js";
import { ChatView }              from "./chat-view.js";

export async function MessagesPage() {
  return {
    components: {
      NavBar:               defineAsyncComponent(NavBar),
      DirectMessageSidebar: defineAsyncComponent(DirectMessageSidebar),
      ChatView:             defineAsyncComponent(ChatView)
    },
    data() {
      return {
        selectedThread: null,
        loading:        false,
        creating:       false
      };
    },
    computed: {
      threadSchema() {
        return {
          type: "object",
          properties: {
            value: {
              type: "object",
              properties: {
                type: { const: "ThreadCreated" },
                participants: {
                  type: "array",
                  contains: { const: this.$graffitiSession.value?.actor }
                }
              },
              required: ["type", "participants"]
            }
          }
        };
      }
    },
    mounted() {
      if (!this.$graffitiSession.value) {
        this.$router.push('/');
      }
      this.$watch(
        
        () => this.$graffitiSession.value,
        (sess) => { 
          if (!sess){
            this.$router.push('/');
          }
          if (!sess && this.selectedThread) {
            this.selectedThread = null;
          }
        }
      );
    },
    methods: {
      formatThreads(threadObjects) {
        if (!threadObjects || !threadObjects.length || !this.$graffitiSession.value) {
          return [];
        }
        
        const actor = this.$graffitiSession.value.actor;
        return threadObjects.map(obj => ({
          channel: obj.value.channel,
          name: obj.value.participants.find(p => p !== actor),
          isCommunity: false
        }));
      },
      
      async createThread(peerId) {
        this.loading = true;
        try {
          const session = this.$graffitiSession.value;
          const actor = await session.actor;
          
          if (!peerId || peerId === actor) return;
          
          const participants = [actor, peerId].sort();
          const channelId = participants.join("-");
          
          await this.$graffiti.put(
            {
              value: {
                type: "ThreadCreated",
                channel: channelId,
                participants: participants
              },
              channels: [actor, peerId]
            },
            session
          );
          
          // The thread will be added automatically via graffiti-discover! (much better than my manual approach from last time lol)
        } finally {
          this.loading = false;
        }
      },
      
      selectThread(thread) {
        this.selectedThread = thread;
      }
    },
    template: await fetch("./messages-page.html").then(r => r.text())
  };
}