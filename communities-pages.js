// communities-page.js
import { defineAsyncComponent } from "vue";
import { NavBar } from "./nav-bar.js";
import { CommunitySidebar } from "./community-sidebar.js";
import { ChatView } from "./chat-view.js";
import { EventView } from "./event-view.js"; 

export async function CommunitiesPage() {
  return {
    components: {
      NavBar: defineAsyncComponent(NavBar),
      CommunitySidebar: defineAsyncComponent(CommunitySidebar),
      ChatView: defineAsyncComponent(ChatView),
      EventView: defineAsyncComponent(EventView)
    },
    data() {
      return {
        selectedCommunity: null,
        loading: false,
        creating: false,
        joinedChannels: new Set(), // keep which communities the user has joined
        activeTab: 'chat', // make chat first
        premadeCommunities: [
          { name: "Biking in Boston", channel: "premade:biking" },
          { name: "Monday Bowling", channel: "premade:bowling" },
          { name: "Cooking Club", channel: "premade:cooking" },
          { name: "Photography Group", channel: "premade:photography" }
        ]
      };
    },
    computed: {
      communitySchema() {
        return {
          properties: {
            value: {
              required: ["activity", "object"],
              properties: { 
                activity: { const: "CreateCommunity" },
                object: {
                  required: ["type", "name", "channel"],
                  properties: {
                    type: { const: "Community" }
                  }
                }
              }
            }
          }
        };
      },
      joinSchema() {
        return {
          properties: {
            value: {
              required: ["activity", "object"],
              properties: { 
                activity: { const: "JoinCommunity" },
                object: {
                  required: ["type", "community", "joinedBy"],
                  properties: {
                    type: { const: "JoinAction" }
                  }
                }
              }
            }
          }
        };
      },
      leaveSchema() {
        return {
          properties: {
            value: {
              required: ["activity", "object"],
              properties: { 
                activity: { const: "LeaveCommunity" },
                object: {
                  required: ["type", "community", "leftBy"],
                  properties: {
                    type: { const: "LeaveAction" }
                  }
                }
              }
            }
          }
        };
      },
      renameSchema() {
        return {
          properties: {
            value: {
              required: ["name", "describes"],
              properties: {
                describes: { type: "string" },
                name: { type: "string" }
              }
            }
          }
        };
      }
    },
    async mounted() {
      if (this.$graffitiSession.value) {

        await this.processedCommunities([]);
        await this.loadJoinStatus();
      }
      if (!this.$graffitiSession.value) {
        this.$router.push('/');
      }
      
      this.$watch(
        () => this.$graffitiSession.value,
        async (newSession) => {
          if (!newSession){
            this.$router.push('/');
          }
          if (newSession) {
            // Load join status
            await this.loadJoinStatus();
          } else {
            this.selectedCommunity = null;
            this.joinedChannels.clear();
          }
        }
      );
    },
    methods: {
      processedCommunities(communityObjects) {

        let communityMap = {};
        
        for (const obj of communityObjects) {
          try {
            const communityObject = obj.value.object;
            communityMap[communityObject.channel] = { 
              channel: communityObject.channel, 
              name: communityObject.name,
              createdBy: communityObject.createdBy,
              createdAt: communityObject.createdAt || 0
            };
          } catch (error) {
            console.error("Error processing community object:", error);
          }
        }
        
        const premadeCommunities = [
          { name: "Biking in Boston", channel: "premade:biking" },
          { name: "Monday Bowling", channel: "premade:bowling" },
          { name: "Cooking Club", channel: "premade:cooking" },
          { name: "Photography Group", channel: "premade:photography" }
        ];
        
        for (const premade of premadeCommunities) {
          if (!communityMap[premade.channel]) {
            communityMap[premade.channel] = { 
              channel: premade.channel, 
              name: premade.name,
              createdBy: "system",
              createdAt: 0
            };
          }
        }
      
        this.processRenames(communityMap);
      
        let communityArray = Object.values(communityMap);
        communityArray.sort((a, b) => b.createdAt - a.createdAt);
        this.updateSelectedCommunity(communityArray);
        
        return communityArray;
      },
  
      async processRenames(communityMap) { 
        // this will be more helpful later when i let admin rename groups
        const renames = this.$graffiti.discover(["designftw"], this.renameSchema);
        
        for await (const { object } of renames) {
          const { describes, name } = object.value;
          if (communityMap[describes]) {
            communityMap[describes].name = name;
          }
        }
      },
      
      updateSelectedCommunity(communityArray) { // workflow for selecting the current community due to user input
        const joinedCommunities = communityArray.filter(c => this.joinedChannels.has(c.channel));
        
        if (!this.selectedCommunity && joinedCommunities.length > 0) {
          this.enterCommunity(joinedCommunities[0]);
        } else if (this.selectedCommunity) {
          const stillExists = communityArray.some(c => c.channel === this.selectedCommunity.channel);
          const stillJoined = this.joinedChannels.has(this.selectedCommunity.channel);
          
          if (!stillExists || !stillJoined) {
            this.selectedCommunity = joinedCommunities.length > 0 ? joinedCommunities[0] : null;
          } else {
            const updatedCommunity = communityArray.find(c => c.channel === this.selectedCommunity.channel);
            if (updatedCommunity) {
              this.selectedCommunity = updatedCommunity;
            }
          }
        }
      },
      
      generateUUID() {
        // was having issues rendering on google chrome because of the stupid [::] but localhost: should work
        if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
          return crypto.randomUUID();
        } ;
      },
      
      delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
      },
      
      async createCommunity(name) {
        this.loading = true;
        this.creating = true;
        
        try {
          const me = this.$graffitiSession.value.actor || this.$graffitiSession.value.id;
          let channel = this.generateUUID();
          
          await this.$graffiti.put(
            {
              value: {
                activity: "CreateCommunity",
                object: {
                  type: "Community",
                  name: name,
                  channel: channel,
                  createdBy: me,
                  createdAt: Date.now()
                },
              },
              channels: ["designftw"],
            },
            this.$graffitiSession.value
          );
          
          // join when u make one
          await this.doJoinCommunity(channel);
          this.joinedChannels.add(channel);
        } catch (error) {
          console.error("Error creating community:", error);
        } finally {
          this.loading = false;
          this.creating = false;
        }
      },
      
      async doJoinCommunity(channelId) {
        const me = this.$graffitiSession.value.actor || this.$graffitiSession.value.id;
        
        // join that we can delete later if we leave
        await this.$graffiti.put(
          {
            value: {
              activity: "JoinCommunity",
              object: {
                type: "JoinAction",
                community: channelId,
                joinedBy: me,
                joinedAt: Date.now()
              },
            },
            channels: ["designftw"],
          },
          this.$graffitiSession.value
        );
      },
      
      async doLeaveCommunity(channelId) {
        const me = this.$graffitiSession.value.actor || this.$graffitiSession.value.id;
        
        // Find the join record for this community
        const joins = this.$graffiti.discover(["designftw"], this.joinSchema);
        let joinId = null;
        
        for await (const { id, object } of joins) {
          const joinObj = object.value.object;
          if (joinObj.joinedBy === me && joinObj.community === channelId) {
            joinId = id;
            break;
          }
        }

        if (joinId) {
          await this.$graffiti.delete(joinId, this.$graffitiSession.value); // delete the join record so we cna rejoin later!
        }
      },
      
      async joinCommunity(community) {
        this.loading = true;
        
        try {
          // await this.delay(1000);
          this.joinedChannels.add(community.channel);
          
          this.enterCommunity(community);
          await this.doJoinCommunity(community.channel);
        } catch (error) {
          console.error("Error joining community:", error);
          // If there was an error, remove from joined channels
          this.joinedChannels.delete(community.channel);
        } finally {
          this.loading = false;
        }
      },
      
      async leaveCommunity(community) {
        this.loading = true;
        
        try {
          // await this.delay(1000);
          this.joinedChannels.delete(community.channel);
          
          if (this.selectedCommunity && this.selectedCommunity.channel === community.channel) {
            const joinedCommunities = Array.from(this.joinedChannels);
            if (joinedCommunities.length > 0) {
              const nextCommunity = this.$refs.communitySidebar?.allCommunities.find(
                c => joinedCommunities.includes(c.channel)
              );
              this.selectedCommunity = nextCommunity || null;
            } else {
              this.selectedCommunity = null;
            }
          }
          await this.doLeaveCommunity(community.channel);
        } catch (error) {
          console.error("Error leaving community:", error);
          this.joinedChannels.add(community.channel);
        } finally {
          this.loading = false;
        }
      },
      
      async loadJoinStatus() {
        try {
          this.joinedChannels.clear();
          const joins = this.$graffiti.discover(["designftw"], this.joinSchema);
          
          const leaves = this.$graffiti.discover(["designftw"], this.leaveSchema);
          
          const me = this.$graffitiSession.value.actor || this.$graffitiSession.value.id;
        
          let joinedCommunities = new Set();
          let leftCommunities = new Set();
  
          for await (const { object } of leaves) {
            const leaveObject = object.value.object;
            if (leaveObject.leftBy === me) {
              leftCommunities.add(leaveObject.community);
            }
          }
          for await (const { object } of joins) {
            const joinObject = object.value.object;
            if (joinObject.joinedBy === me) {
              joinedCommunities.add(joinObject.community);
            }
          }
          
          for (const channel of joinedCommunities) {
            if (!leftCommunities.has(channel)) {
              this.joinedChannels.add(channel);
            }
          }
        } catch (error) {
          console.error("Error loading");
        }
      },
      
      enterCommunity(community) {
        this.selectedCommunity = community;
        this.activeTab = 'chat'; // Reset to chat tab when switching communities
      },
      
      handleChannelRenamed(data) { // will be useful when i let admins rename groups
        console.log(`Channel ${data.channelId} renamed to ${data.newName}`);
      }
    },
    template: await fetch("./communities-page.html").then((r) => r.text())
  };
}