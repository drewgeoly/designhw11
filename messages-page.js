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
      async formatThreads(threadObjects) {
        if (!threadObjects || !threadObjects.length || !this.$graffitiSession.value) {
          return [];
        }
        
        const actor = this.$graffitiSession.value.actor;
        const formattedThreads = [];

        for (const thread of threadObjects) {
          const peerActorId = obj.value.participants.find(p => p !== actor);
          let peerUsername = peerActorId;

          const usernameSchema = {
            type: "object",
            properties: {
              value: {
                type: "object",
                properties: {
                  type: { const: "username" },
                  // username: { type: "string" },
                  actor: { const: peerActorId }
                },
                required: ["type", "username", "actor"]
              }
            }
          }
          for await (const { obj1 } of this.$graffiti.discover(["dgeolyUsernames"], usernameSchema)) {
            peerUsername = obj1.value.username;
            break;
          }
          formattedThreads.push({
            channel: thread.value.channel,
            name: peerUsername,
            ifCommunity: false
          });

        }
        return formattedThreads;
      },
      async checkUsernameSet() {
        const schema = {
          type: "object",
          properties: {
            value: {
              type: "object",
              properties: {
                type: { const: "username" },
                username: { type: "string" },
                actor: { type: "string" }
            },
              required: ["type", "username", "actor"]
            }
          }
        };
        const actor = this.$graffitiSession.value?.actor;
        const usernames = this.$graffiti.discover(["dgeolyUsernames"], schema);
        
        for await (const { object } of usernames) {
          if (object.value.actor === actor) {
            this.username = object.value.username;
            return true;
          }
        }
        return false;
      },
      
      async createThread(peerId) {
        this.loading = true;
        try {
          const session = this.$graffitiSession.value;
          const actor = await session.actor;
          const usernameSchema = {
            type: "object",
            properties: {
              value: {
                type: "object",
                properties: {
                  type: { const: "username" },
                  username: { const: peerId },
                  actor: { type: "string" }
              },
                required: ["type", "username", "actor"]
              }
            }
          };

          // changing this to use usernames instead of actors
          const hasUsername = await this.checkUsernameSet();
          if (!hasUsername) {
            alert("You must create a profile and username before messaging.");
            return;
          }

          // check if the peerId has a profile
          let peerActorId = false;
          for await (const { object } of this.$graffiti.discover(["dgeolyUsernames"], usernameSchema)) {
            if (object.value.username === peerId) {
              peerActorId = object.value.actor;
              break;
            }
          }
          if (!peerActorId) {
            alert("The user you are trying to message does not have a profile. Please ask them to create one.");
            return;
          }

          if (!peerId || peerActorId === actor) return;
          
          const participants = [actor, peerActorId].sort();
          const channelId = participants.join("-");
          
          await this.$graffiti.put(
            {
              value: {
                type: "ThreadCreated",
                channel: channelId,
                participants: participants
              },
              channels: [actor, peerActorId]
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