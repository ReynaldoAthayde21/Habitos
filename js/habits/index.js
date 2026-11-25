// Registro dos hábitos. Para adicionar um novo hábito:
// 1. crie js/habits/novo.js seguindo o formato dos outros (id, tabId, title, emoji, color,
//    defaults, renderTab, renderToday, todayChecks?, hasRecord, dayDetail, evolution, actions);
// 2. importe e coloque na lista abaixo. Ele aparece sozinho na aba, no "Hoje",
//    no calendário do Histórico e na Evolução.
import meals from './meals.js';
import water from './water.js';
import workout from './workout.js';
import reading from './reading.js';
import body from './body.js';
import nutri from './nutri.js';

export const HABITS = [meals, water, workout, reading, body, nutri];
