export async function EventItem() {
    return {
        props: {
            event: {
                type: Object,
                required: true
            },
            communityId: {
                type: String,
                required: true
            }
        },
        data() {
            return {
                attendees: [],
                isAttending: false, 
                loadingRsvp: false,
                showAttendees: false,
                username: ""
            };
        },
        computed: {
            // tons of basic formatting stuff for events
            formattedDate() {
                if (!this.event || !this.event.value) {
                    return '';
                }

                const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
                return new Date(this.event.value.date).toLocaleDateString(undefined, options);
            },
            formattedTime() {
                if (!this.event || !this.event.value) {
                    return '';
                } 
                return this.event.value.time;
            },
            isCreator() {
                const me = this.$graffitiSession.value?.actor || this.$graffitiSession.value?.id;
                return this.event.value.createdBy === me;
            },
            isFull() {
                if (!this.event || !this.event.value || this.event.value.maxAttendees === undefined) {
                    return false;
                }
                return (this.attendees.length >= this.event.value.maxAttendees);
            },
            attendeeCount() {
                return this.attendees.length;
            },
            isEventPast() {
                if (!this.event || !this.event.value) {
                    return false;
                }
                const eventDate = new Date(this.event.value.date + " " + this.event.value.time);
                const currentDate = new Date();
                return eventDate < currentDate;
            },
            canRsvp() {
                return !this.isEventPast && !this.isFull
            },
            rsvpSchema() {
                return {
                    properties: {
                        value: {
                            required: ["type", "eventId", "userId"],
                            properties: {
                                type: { const: "RSVP" },
                                eventId: { type: "string" },
                                userId: { type: "string" },
                            }
                        }
                    }
                };
            }
        },
        async mounted() {
            if (this.$graffitiSession.value) {
                await this.loadAttendees()
                // await this.checkRsvpStatus();
            }
        },
        methods: {
            async getUsernameFromActor(actorId) {
                if (!actorId) {
                    return actorId;
                }
                const usernameSchema = {
                    type: "object",
                    properties:{
                        value: {
                            type: "object",
                            properties: {
                                type: { const: "username" },
                                actor: { const: actorId }
                            },
                            required: ["type", "username", "actor"]
                        }
                    }
                };
                
                for await (const { object } of this.$graffiti.discover(["dgeolyUsernames"], usernameSchema)) {
                    return object.value.username;
                }
                
                return actorId; // use actor id if i cant find
            },
            
            async checkUsernameSet(){
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
                const actor= this.$graffitiSession.value?.actor;
                const usernames =this.$graffiti.discover(["dgeolyUsernames"], schema);
                for await (const { object } of usernames) {
                    if (object.value.actor === actor) {
                        this.username = object.value.username;
                        return true;
                    }
                }
                return false;
            },
            
            toggleAttendeesList() {
                this.showAttendees = !this.showAttendees;
            },
            
            async checkRsvpStatus() {
                const me = await this.$graffitiSession.value?.actor || this.$graffitiSession.value?.id;
                for (const attendee of this.attendees) {
                    if (attendee.userId === me) {
                        this.isAttending = true;
                        return true;
                    }
                }

                this.isAttending = false;
                return false;
            },
            
            async loadAttendees() {
                this.attendees = [];
                this.loadingRsvp=true;
                const rsvps = this.$graffiti.discover(["dgeolyEvents", this.communityId], this.rsvpSchema);
                for await (const { object } of rsvps) {
                    if (object.value.eventId === this.event.url) {
                        const username = await this.getUsernameFromActor(object.value.userId);
                        this.attendees.push({ 
                            rsvpId: object.url, 
                            userId: object.value.userId, 
                            username: username 
                        });
                    }
                }
                
                await this.checkRsvpStatus();
                this.loadingRsvp=false;
            },
            async postEventNotification(isJoining) {
                try {
                  const me = this.$graffitiSession.value.actor || this.$graffitiSession.value.id;
                  const username = await this.getUsernameFromActor(me);
                  const message = isJoining ? `${username} has RSVP'd to "${this.event.value.title}"`: `${username} has canceled their RSVP to "${this.event.value.title}"`;
                  
                  await this.$graffiti.put(
                    {
                      value: {
                        type: "Message",
                        content: message,
                        published: Date.now(),
                        publishedBy: "system",
                        senderName: "Event Bot", 
                        isSystemMessage: true,
                      },
                      channels: [this.communityId],
                    },
                    this.$graffitiSession.value
                  );
                } catch (error) {
                }
              },
            
            
            async rsvp() { 
                // first check for errors trying to rsvp
                if (!this.$graffitiSession.value || !this.$graffitiSession.value.actor) {
                    alert("You must be logged in to RSVP.");
                    return;
                }
                if (this.isAttending) {
                    alert("You are already registered for this event.");
                    return;
                }
                
                const hasUsername = await this.checkUsernameSet();
                if (!hasUsername) {
                    alert("You must create a profile and username before RSVPing.");
                    return;
                }
                
                if (this.isFull && !this.isAttending) {
                    alert("This event is full. You cannot RSVP.");
                    return;
                }
                
                this.loadingRsvp = true;
                try {
                    const me = this.$graffitiSession.value.actor || this.$graffitiSession.value.id;
                    await this.$graffiti.put(
                        {
                            value: {
                                type: "RSVP",
                                eventId: this.event.url,
                                userId: me,
                                timestamp: Date.now(),
                            },
                            channels: [this.communityId, "dgeolyEvents", me],
                        }, 
                        this.$graffitiSession.value
                    );
                    
                    await this.loadAttendees();
                    await this.postEventNotification(true);
                } catch (error) {
                    console.error("Error RSVPing to event:", error);
                    alert("Failed to RSVP. Please try again.");
                } finally {
                    this.loadingRsvp = false;
                }
            },
            
            async cancelRsvp() {
                if (!this.isAttending) {
                    return;
                }
                
                this.loadingRsvp = true;
                try {
                    const me = this.$graffitiSession.value.actor || this.$graffitiSession.value.id;
                    let myRsvpId = null;
                    for (const attendee of this.attendees) {
                        if (attendee.userId === me) {
                            myRsvpId = attendee.rsvpId;
                            break;
                        }
                    }
                    
                    if (myRsvpId) {
                        await this.$graffiti.delete(myRsvpId, this.$graffitiSession.value);
                        await this.loadAttendees();
                        await this.postEventNotification(false);
                    }
                } catch (error) {
                } finally {
                    this.loadingRsvp = false;
                }
            }
        },
        template: await fetch("./event-item.html").then((r) => r.text())
    };
}