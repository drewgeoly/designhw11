// profile.js
import { NavBar } from "./nav-bar.js";
import { createApp, defineAsyncComponent } from "vue";
export async function Profile() {
  return {
    name: "Profile",
    data() {
      return {
        user: {
          name: "", 
          username: "", 
          pronouns: "", 
          bio: "", 
          status: "", 
          interests: "", 
          isPublic: true, 
        },
        originalUser: null,
        editMode: false,
        loading: true,
        hasProfile: false,
        oldUsername: "", // similar to originaluser
      };
    },
    components: { 
        NavBar: defineAsyncComponent(NavBar),
    },
    mounted() {
      if (this.$graffitiSession.value) this.loadProfile();
      this.$watch(
        () => this.$graffitiSession.value,
        (newSess) => { 
          if (newSess) {
            this.loadProfile();
          } else if (!newSess) { 
            this.$router.push('/'); 
          }
        }
      );
    },
    methods: {
      async loadProfile() {
        this.loading = true;
        try {
          const session = this.$graffitiSession.value;
          if (!session) {
            console.error("No Graffiti session available");
            return;
          }

          const actor = await session.actor;
          const schema = {
            type: "object",
            properties: {
              value: {
                type: "object",
                properties: { describes: { const: actor } },
                required: ["describes"],
              },
            },
          };

          const objs = [];
          for await (const { object } of this.$graffiti.discover([actor], schema, session)) {
            objs.push(object);
          }
          const usernameSchema = {
            type: "object",
            properties: {
              value: {
                type: "object",
                properties: {
                  type: { const: "username" },
                  actor: { const: actor }
                },
                required: ["type", "username", "actor"]
              }
            }
          };
          
          let currentUsername = "";
          for await (const { object } of this.$graffiti.discover(["dgeolyUsernames"], usernameSchema)) {
            currentUsername = object.value.username;
            break; 
          }
          
          if (objs.length) {
            const latest = objs.sort(
              (a, b) =>
                (b.value.published || b.published) -
                (a.value.published || a.published)
            )[0];
            
            this.user = { ...latest.value };
            if (currentUsername) {
              this.user.username = currentUsername;
            }
            this.oldUsername = currentUsername; 
            this.originalUser = JSON.parse(JSON.stringify(this.user));
            this.hasProfile = true;
          } else if (currentUsername) {
            this.user.username = currentUsername;
            this.oldUsername = currentUsername;
            this.hasProfile = false;
          }
        } catch (err) {
          console.error("Error loading profile:", err);
        } finally {
          this.loading = false;
        }
      },

      async isUsernameAvailable(username) {
        if (username === this.oldUsername) {
          return true;
        }
        
        const usernameSchema = {
          type: "object",
          properties: {
            value: {
              type: "object",
              properties: {
                type: { const: "username" },
                username: { type: "string" },
              },
              required: ["type", "username", "actor"]
            }
          }
        };
        
        for await (const { object } of this.$graffiti.discover(["dgeolyUsernames"], usernameSchema)) {
          if (object.value.username === username) {
            return false;
          }
        }
        return true;
      },
      
      async findUsernameObject(actor, username) {
        const usernameSchema = {
          type: "object",
          properties: {
            value: {
              type: "object",
              properties: {
                type: { const: "username" },
                actor: { const: actor }
              },
              required: ["type", "username", "actor"]
            }
          }
        };
        
        for await (const { id, object } of this.$graffiti.discover(["dgeolyUsernames"], usernameSchema)) {
          return { id, object };
        }
        
        return null;
      },

      async saveProfile() {
        this.loading = true;
        try {
          const session = this.$graffitiSession.value;
          if (!session) throw new Error("Not logged in");

          const actor = await session.actor;
          
          //first check if username is available
          if (!(await this.isUsernameAvailable(this.user.username))) {
            alert("Username already exists. Please choose a different one.");
            this.loading = false;
            return;
          }
          
          const vals = {
            name: this.user.name,
            username: this.user.username,
            pronouns: this.user.pronouns,
            bio: this.user.bio,
            status: this.user.status,
            interests: this.user.interests,
            isPublic: this.user.isPublic,
            describes: actor,
            published: Date.now(),
            generator: "https://drewgeoly.github.io/designhw11/",
          };

          const profileObj = {
            value: vals,
            channels: [actor, "designftw-2025-studio1"],
          };
          await this.$graffiti.put(profileObj, session);
          const existingUsername = await this.findUsernameObject(actor, this.user.username);
          
          if (existingUsername) {
            if (this.oldUsername !== this.user.username) {
              //update username stuff
              await this.$graffiti.patch(
                {value: [
                    {
                      op: "replace",
                      path: "/username",
                      value: this.user.username
                    }
                  ]
                },
                existingUsername.id,
                session
              );
            }
          } else {
            await this.$graffiti.put({
              value: {
                type: "username",
                username: this.user.username,
                actor: actor,
              },
              channels: ["dgeolyUsernames"],
            }, session);
          }
          
          this.oldUsername = this.user.username;
          this.originalUser = JSON.parse(JSON.stringify(this.user));
          this.hasProfile = true;
          this.editMode = false;
          alert("Profile saved successfully!");
        } catch (error) {
          console.error("bruh not working")
        } finally {
          this.loading = false;
        }
      },

      cancelEdit() {
        if (this.originalUser) {
          this.user = JSON.parse(JSON.stringify(this.originalUser));
        }
        if (this.hasProfile) {
          this.editMode = false;
        }
      },
    },
    template: await fetch("./profile.html").then(r => r.text()),
  };
}