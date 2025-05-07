import { defineAsyncComponent } from "vue";
import { NavBar } from "./nav-bar.js";

export async function MyRsvpsPage() {
    return {
        components: {
            NavBar: defineAsyncComponent(NavBar)
        },
        data() {
            return {
                rsvpEvents: [],
                loading: true,
                selectedEvent: null, 
                selectedEventAttendees: [],
            };
        },
        computed: {
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
            },
            eventSchema() {
                return {
                    properties: {
                        value: {
                            required: ["type"],
                            properties: {
                                type: { const: "Event" }
                             }
                        }
                    }
                };
            },
            upcomingEvents() {
                let upcoming = this.rsvpEvents.filter(event => {
                    const eventDate = new Date(event.eventData.date + " " + event.eventData.time);
                    const currentDate = new Date();
                    return eventDate >= currentDate;
                });
                
                upcoming.sort((a, b) => {
                    const dateA = new Date(a.eventData.date + " " + a.eventData.time);
                    const dateB = new Date(b.eventData.date + " " + b.eventData.time)
                    return dateA - dateB;
                });
                
                return upcoming;
            },
            pastEvents() {
                let done = this.rsvpEvents.filter(event => {
                    const eventDate = new Date(event.eventData.date + " " + event.eventData.time);
                    const currentDate = new Date();
                    return eventDate < currentDate;
                });
                
                done.sort((a, b) => {
                    const dateA = new Date(a.eventData.date + " " + a.eventData.time);
                    const dateB = new Date(b.eventData.date + " " + b.eventData.time);
                    return dateB - dateA; // reverse order for past events
                });
                
                return done;
            }
        },
        async mounted() {
            if (this.$graffitiSession.value) {
                await this.loadRsvpEvents();
            } else {
                this.$router.push('/');
            }
            
            this.$watch(
                () => this.$graffitiSession.value,
                async (newSess) => {
                    if (!newSess) {
                        this.$router.push("/");
                    } else {
                        await this.loadRsvpEvents();
                    }
                }
            );
        },
        methods: {
            formatDate(dateString) {
                if (!dateString) return '';
        
                const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
                return new Date(dateString).toLocaleDateString(undefined, options);
            },
            
            selectEvent(event) {
                this.selectedEvent = event;
                this.loadEventAttendees(event);
            },

            closeEventDetails() {
                this.selectedEvent = null;
                this.selectedEventAttendees = [];
            },

            async loadRsvpEvents() {
                this.loading = true;
                try {
                    const me = this.$graffitiSession.value.actor || this.$graffitiSession.value.id;
                    const rsvps = this.$graffiti.discover([me], this.rsvpSchema);
                    const events = [];

                    for await (const { object } of rsvps) {
                        const eventId = object.value.eventId;
                        try {
                            // try to get
                            const eventObj = await this.$graffiti.get(eventId, this.eventSchema, this.$graffitiSession.value);
                            if (eventObj && eventObj.value && eventObj.value.type === "Event") {
                                events.push({
                                    rsvpId: object.url,
                                    eventId: eventId,
                                    eventData: eventObj.value,
                                    communityId: eventObj.value.communityId,
                                });
                            }
                        } catch (err) {
                           
                        }
                    }
                    
                    this.rsvpEvents = events;
                } catch (error) {
                   
                } finally {
                    this.loading = false;
                }
            },
            
            async loadEventAttendees(event) {
                this.selectedEventAttendees = [];
                const rsvps = this.$graffiti.discover([event.communityId, "dgeolyEvents"], this.rsvpSchema);
                
                for await (const { object } of rsvps) {
                    if (object.value.eventId === event.eventId) {
                        const username = await this.getUsernameFromActor(object.value.userId);
                        this.selectedEventAttendees.push({
                            username: username,
                            actor: object.value.userId,
                        });
                    }
                }
            },
            
            async getUsernameFromActor(actorId) {
                if (!actorId) {
                    return "Unknown";
                }
                
                const usernameSchema = {
                    type: "object",
                    properties: {
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
                
                return actorId; // Fallback to actor ID if username not found
            },
            
            async cancelRsvp(event) {
                if (!event.rsvpId) {
                    return;
                }
                
                if (confirm("Are you sure you want to cancel your RSVP?")) {
                    try {
                        await this.$graffiti.delete(event.rsvpId, this.$graffitiSession.value);
                        await this.loadRsvpEvents();
                        if (this.selectedEvent && this.selectedEvent.rsvpId === event.rsvpId) {
                            this.closeEventDetails();
                        }
                    } catch (error) {
                       
                    
                    }
                }
            }
        },
        template: await fetch("./my-rsvps-page.html").then((r) => r.text()),
    };
}