import { createRouter, createWebHashHistory } from 'vue-router'
import Calendar from '../views/Calendar.vue'
import Tasks from '../views/Tasks.vue'
import Stats from '../views/Stats.vue'
import Settings from '../views/Settings.vue'
import Performance from '../views/Performance.vue'

const routes = [
  { path: '/', redirect: '/calendar' },
  { path: '/calendar', name: 'calendar', component: Calendar },
  { path: '/tasks', name: 'tasks', component: Tasks },
  { path: '/stats', name: 'stats', component: Stats },
  { path: '/settings', name: 'settings', component: Settings },
  { path: '/performance', name: 'performance', component: Performance }
]

export default createRouter({
  history: createWebHashHistory(),
  routes
})
