import { defineAsyncComponent } from 'vue';
import { EventItem } from "./event-item.js";

export async function EventView() {
    return {
        components: {
            EventItem: defineAsyncComponent(EventItem)
        },
        props: {
            community: {
                type: Object,
                default: null
            }
        },
        data() {
            return {
                newEvent: { 
                    title: '', 
                    description: '', 
                    location: '', 
                    date: '', 
                    time: '',
                    maxAttendees: 5 // idk random default 
                }, 
                showCreateForm: false, 
                sending: false,
                loading: false,
                showProfileModal: false,
                profileModalMessage: ""
            };
        },
        computed: {
            communityNameDisplay() {
                return this.community ? (this.community.isCommunity ? '#' : '') + this.community.name : '—';
            },
            communityId() {
                return this.community ? this.community.channel : null;
            },
            eventSchema() {
                return {
                    properties: {
                        value: {
                            properties: {
                                type: { const: "Event" },
                                communityId: { const: this.communityId }
                            },
                            required: ["type", "title", "description", "location", "date", "time", "communityId"]
                        }
                    }
                };
            }
        },
        methods: { 
            sortedEvents(eventObjects) {
                if (!eventObjects || !eventObjects.length) {
                    return [];
                }
                const communityEvents = eventObjects.filter(event => event.value.communityId === this.communityId); // events just in this community
                return communityEvents.sort((a, b) => {
                    const dateA = new Date(a.value.date + " " + a.value.time);
                    const dateB = new Date(b.value.date + " " + b.value.time);
                    return dateA - dateB;
                });
            },
            
            upcomingEvents(eventObjects) {
                const sorted = this.sortedEvents(eventObjects);
                const now = new Date();
                
                return sorted.filter(event => {
                    const eventDate = new Date(event.value.date + " " + event.value.time);
                    return eventDate >= now;
                });
            },
            
            pastEvents(eventObjects) {
                const sorted = this.sortedEvents(eventObjects);
                const now = new Date();
                
                return sorted.filter(event => {
                    const eventDate = new Date(event.value.date + " " + event.value.time);
                    return eventDate < now;
                }).sort((a, b) => {
                    // put em backwards
                    const dateA = new Date(a.value.date + " " + a.value.time);
                    const dateB = new Date(b.value.date + " " + b.value.time);
                    return dateB - dateA;
                });
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
                    return true;
                  }
                }
                return false;
            },

            async toggleCreateForm() {
                const hasUsername = await this.checkUsernameSet();
                if (!hasUsername) {
                    alert("You must create a profile and username before creating events.");
                    return;
                }
                this.showCreateForm = !this.showCreateForm;
                if (this.showCreateForm) {
                    // reset form
                    this.newEvent = { 
                        title: '', 
                        description: '', 
                        location: '', 
                        date: '', 
                        time: '',
                        maxAttendees: 5 
                    };
                }
            },
            
            async createEvent(session) {
                if (!this.communityId) {
                    return;
                }
                
                const hasUsername = await this.checkUsernameSet();
                if (!hasUsername) {
                    alert("You must create a profile and username before creating events.");
                    return;
                }
                
                if (!this.newEvent.title.trim() || 
                    !this.newEvent.description.trim() || 
                    !this.newEvent.location.trim() || 
                    !this.newEvent.date.trim() || 
                    !this.newEvent.time.trim() || 
                    this.newEvent.maxAttendees <= 0) {
                    alert("Please fill out all fields and ensure max attendees is greater than 0.");
                    return;
                }
                
                this.sending = true;
                const me = session.actor || session.id;

                try {
                    await this.$graffiti.put(
                        {
                            value: {
                                type: "Event",
                                title: this.newEvent.title,
                                description: this.newEvent.description,
                                location: this.newEvent.location,
                                date: this.newEvent.date,
                                time: this.newEvent.time,
                                maxAttendees: parseInt(this.newEvent.maxAttendees), // parse int for weird maxattendeeds formatting for putting
                                communityId: this.communityId,
                                createdBy: me,
                                published: Date.now(),
                            },
                            channels: [this.communityId, "dgeolyEvents"],
                        }, session);
                    
                    this.toggleCreateForm();
                } catch (error) {
                } finally {
                    this.sending = false;
                }
            },
        },
        template: await fetch("./event-view.html").then((r) => r.text()),
    };
}