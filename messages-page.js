import { defineAsyncComponent } from "vue";
import { NavBar } from "./nav-bar.js";
import { DirectMessageSidebar } from "./direct-message-sidebar.js";
import { ChatView } from "./chat-view.js";

export async function MessagesPage() {
  return {
    components: {
      NavBar: defineAsyncComponent(NavBar),
      DirectMessageSidebar: defineAsyncComponent(DirectMessageSidebar),
      ChatView: defineAsyncComponent(ChatView)
    },
    data() {
      return {
        selectedThread: null,
        loading: false,
        creating: false,
        usernameToActorMap: {}, // cache mapping of usernames to actorIds
        actorToUsernameMap: {}  // cache mapping of actorIds to usernames
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
      },
      usernameSchema() {
        return {
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
      }
    },
    async mounted() {
      if (!this.$graffitiSession.value) {
        this.$router.push('/');
      } else {
        await this.loadUsernameMappings();
      }
      this.$watch(
        () => this.$graffitiSession.value,
        async (sess) => { 
          if (!sess) {
            this.$router.push('/');
          }
          if (sess && !this.selectedThread) {
            await this.loadUsernameMappings();
          }
        }
      );
    },
    methods: {
      async loadUsernameMappings() {
        this.loading = true;
        try {
          // first clear mapping
          // need to change how we do this to work with profile usernames now
          // will discuss how to navigate users display names vs usernames l8r
          this.usernameToActorMap = {};
          this.actorToUsernameMap = {};
          for await (const { object } of this.$graffiti.discover(["dgeolyUsernames"], this.usernameSchema)) {
            const username = object.value.username;
            const actor = object.value.actor;
            this.usernameToActorMap[username] = actor;
            this.actorToUsernameMap[actor] = username;
          }
        } catch (error) {
        } finally {
          this.loading = false;
        }
      },
      
      formatThreads(threadObjects) {
        if (!threadObjects || !threadObjects.length || !this.$graffitiSession.value) {
          return [];
        }
        const actor = this.$graffitiSession.value.actor;
        return threadObjects.map(obj => {
          const otherActor = obj.value.participants.find(p => p !== actor);
          
          if (!otherActor) {
            return null; 
          }
          const displayName = this.actorToUsernameMap[otherActor] || otherActor;
          
          return {
            channel: obj.value.channel,
            name: displayName,
            actorId: otherActor,
            isCommunity: false
          };
        }).filter(thread => thread !== null);
      },
      
      async getActorIdFromUsername(username) {
        if (this.usernameToActorMap[username]) {
          return this.usernameToActorMap[username];
        }
        await this.loadUsernameMappings();
        return this.usernameToActorMap[username] || null;
      },
      
      async createThread(username) {
        this.loading = true;
        try {
          const session = this.$graffitiSession.value;
          const myActor = await session.actor;
  
          const peerActorId = await this.getActorIdFromUsername(username);
          
          //basic errors for people trying to messge
          if (!peerActorId) {
            alert(`No user found with username: ${username}`);
            return;
          }
          
          // will maybe afford self messaging later? dopnt know how to format well though
          if (peerActorId === myActor) {
            alert("You cannot message yourself!");
            return;
          }
          
          const participants = [myActor, peerActorId].sort();
          const channelId = participants.join("-");
        
          let threadExists = false;
          let existingThread = null;
          const threads = this.$graffiti.discover([myActor], this.threadSchema);
          for await (const { object } of threads) {
            if (object.value.participants.includes(peerActorId)) {
              threadExists = true;
              existingThread = {
                channel: object.value.channel,
                name: this.actorToUsernameMap[peerActorId] || peerActorId,
                actorId: peerActorId,
                isCommunity: false
              };
              break;
            }
          }
          
          if (threadExists && existingThread) { // if one exists just use it
            this.selectThread(existingThread);
            this.loading = false;
            return;
          }
        
          await this.$graffiti.put(
            {
              value: {
                type: "ThreadCreated",
                channel: channelId,
                participants: participants
              },
              channels: [myActor, peerActorId]
            },
            session
          );
          
          // update cache
          if (!this.actorToUsernameMap[peerActorId]) {
            this.actorToUsernameMap[peerActorId] = username;
            this.usernameToActorMap[username] = peerActorId;
          }
        } catch (error) {
          console.error("Error creating thread:", error);
          alert("Error creating thread: " + error.message);
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