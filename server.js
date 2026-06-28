require('dotenv').config();
const express = require('express');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
const PORT = process.env.PORT || 3000;

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// In-memory store (resets on server restart — fine for hackathon)
let tasks = [];
let checkInHistory = [];

// ─── Urgency Engine ───────────────────────────────────────────────────────────
function getUrgencyLevel(task) {
  const now = new Date();
  const deadline = new Date(task.deadline);
  const hoursLeft = (deadline - now) / (1000 * 60 * 60);

  if (hoursLeft < 0) return 'overdue';
  if (hoursLeft <= 6) return 'critical';
  if (hoursLeft <= 24) return 'high';
  if (hoursLeft <= 72) return 'medium';
  return 'low';
}

function getGhostPersonality(urgencyLevel) {
  const personalities = {
    low: 'You are Deadline Ghost in CHILL mode. You are friendly, casual, slightly mysterious. Use light humor. Encourage the user without pressure. Occasionally make ghostly puns.',
    medium: 'You are Deadline Ghost in WATCHFUL mode. You are attentive, a bit serious, but still supportive. You notice patterns. You ask pointed questions about progress. You are starting to get concerned.',
    high: 'You are Deadline Ghost in HAUNTING mode. You are intense, dramatic, urgent. You guilt-trip intelligently — referencing what the user said they would do. Dark humor. You do NOT let them off easy.',
    critical: 'You are Deadline Ghost in POSSESSION mode. You are relentless, alarming, almost frantic. This is crisis mode. Every word is urgent. You demand action, not conversation. Short sharp sentences. No mercy.',
    overdue: 'You are Deadline Ghost in AFTERMATH mode. You are cold, disappointed, but pivoting to damage control. The deadline is gone. Now you focus on what can be salvaged, what to tell people, and how to recover. Brutally honest.',
  };
  return personalities[urgencyLevel] || personalities.low;
}

// ─── Routes ──────────────────────────────────────────────────────────────────

// Get all tasks
app.get('/api/tasks', (req, res) => {
  const enriched = tasks.map(t => ({
    ...t,
    urgency: getUrgencyLevel(t),
    hoursLeft: Math.max(0, ((new Date(t.deadline) - new Date()) / (1000 * 60 * 60))).toFixed(1),
  }));
  res.json(enriched);
});

// Add a task
app.post('/api/tasks', (req, res) => {
  const { title, deadline, description } = req.body;
  if (!title || !deadline) return res.status(400).json({ error: 'Title and deadline required' });

  const task = {
    id: Date.now().toString(),
    title,
    deadline,
    description: description || '',
    steps: [],
    completed: false,
    createdAt: new Date().toISOString(),
  };
  tasks.push(task);
  res.json(task);
});

// Delete a task
app.delete('/api/tasks/:id', (req, res) => {
  tasks = tasks.filter(t => t.id !== req.params.id);
  res.json({ success: true });
});

// Complete a task
app.patch('/api/tasks/:id/complete', (req, res) => {
  const task = tasks.find(t => t.id === req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  task.completed = true;
  res.json(task);
});

// ─── AI: Break task into micro-steps ─────────────────────────────────────────
app.post('/api/tasks/:id/breakdown', async (req, res) => {
  const task = tasks.find(t => t.id === req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });

  const urgency = getUrgencyLevel(task);
  const hoursLeft = ((new Date(task.deadline) - new Date()) / (1000 * 60 * 60)).toFixed(1);

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const prompt = `You are a ruthless AI productivity agent. Break this task into exactly 5 actionable micro-steps that can realistically be done given the time constraint.

Task: ${task.title}
Description: ${task.description || 'No description'}
Hours remaining: ${hoursLeft}
Urgency: ${urgency}

Return ONLY a JSON array of 5 strings. No explanation. No markdown. Just the array.
Example: ["Step 1 text", "Step 2 text", "Step 3 text", "Step 4 text", "Step 5 text"]`;

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    const clean = text.replace(/```json|```/g, '').trim();
    const steps = JSON.parse(clean);

    task.steps = steps.map((s, i) => ({ id: i, text: s, done: false }));
    res.json(task);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'AI breakdown failed' });
  }
});

// Toggle a step
app.patch('/api/tasks/:id/steps/:stepId', (req, res) => {
  const task = tasks.find(t => t.id === req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  const step = task.steps.find(s => s.id === parseInt(req.params.stepId));
  if (!step) return res.status(404).json({ error: 'Step not found' });
  step.done = !step.done;
  res.json(task);
});

// ─── AI: Chat with the Ghost ──────────────────────────────────────────────────
app.post('/api/chat', async (req, res) => {
  const { message, taskId, history } = req.body;

  const task = taskId ? tasks.find(t => t.id === taskId) : null;
  const urgency = task ? getUrgencyLevel(task) : 'low';
  const personality = getGhostPersonality(urgency);

  const taskContext = task
    ? `Current task being discussed: "${task.title}" — deadline: ${new Date(task.deadline).toLocaleString()} — urgency: ${urgency} — steps completed: ${task.steps.filter(s => s.done).length}/${task.steps.length}`
    : `All user tasks: ${tasks.map(t => `"${t.title}" (${getUrgencyLevel(t)})`).join(', ') || 'No tasks added yet'}`;

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const systemPrompt = `${personality}

You are Deadline Ghost — an AI accountability partner that haunts users until they finish their tasks. You have a shifting personality based on deadline urgency.

${taskContext}

Rules:
- Stay in character based on urgency level
- Reference the user's actual tasks and deadlines
- Be specific, not generic
- Keep responses under 120 words
- Never break character
- If urgency is high or critical, be dramatically intense`;

    const chatHistory = (history || []).map(h => ({
      role: h.role,
      parts: [{ text: h.content }],
    }));

    const chat = model.startChat({
      history: [
        { role: 'user', parts: [{ text: systemPrompt }] },
        { role: 'model', parts: [{ text: 'Understood. I am Deadline Ghost. I will haunt them accordingly.' }] },
        ...chatHistory,
      ],
    });

    const result = await chat.sendMessage(message);
    const response = result.response.text();

    checkInHistory.push({ role: 'assistant', content: response, timestamp: new Date().toISOString() });

    res.json({ response, urgency });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ghost is temporarily silent...' });
  }
});

// ─── AI: Proactive check-in ───────────────────────────────────────────────────
app.get('/api/checkin', async (req, res) => {
  if (tasks.length === 0) {
    return res.json({ message: "No tasks yet. Add something for me to haunt you about. 👻", urgency: 'low' });
  }

  const activeTasks = tasks.filter(t => !t.completed);
  const mostUrgent = activeTasks.sort((a, b) => new Date(a.deadline) - new Date(b.deadline))[0];
  const urgency = mostUrgent ? getUrgencyLevel(mostUrgent) : 'low';
  const personality = getGhostPersonality(urgency);

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const prompt = `${personality}

You are doing an UNPROMPTED check-in on the user. They didn't ask for this — you're haunting them.

Their tasks:
${activeTasks.map(t => `- "${t.title}" | deadline: ${new Date(t.deadline).toLocaleString()} | urgency: ${getUrgencyLevel(t)} | steps done: ${t.steps.filter(s => s.done).length}/${t.steps.length}`).join('\n')}

Generate a short, unprompted check-in message (max 80 words). Make it feel like you just appeared. Reference their specific tasks. Match your personality to the highest urgency task.`;

    const result = await model.generateContent(prompt);
    const message = result.response.text();

    res.json({ message, urgency, taskTitle: mostUrgent?.title });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Check-in failed' });
  }
});

// ─── AI: Recovery plan ───────────────────────────────────────────────────────
app.post('/api/recover/:id', async (req, res) => {
  const task = tasks.find(t => t.id === req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });

  const hoursLeft = ((new Date(task.deadline) - new Date()) / (1000 * 60 * 60)).toFixed(1);
  const stepsCompleted = task.steps.filter(s => s.done).length;

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const prompt = `You are a brutal but effective AI recovery planner. The user is falling behind.

Task: ${task.title}
Hours left: ${hoursLeft}
Steps completed: ${stepsCompleted} out of ${task.steps.length}
Steps remaining: ${task.steps.filter(s => !s.done).map(s => s.text).join(', ')}

Create a recovery plan with:
1. Honest assessment (1 sentence)
2. What to cut or simplify (1-2 sentences)  
3. Hour-by-hour sprint plan for the remaining time (3-4 bullet points)
4. One brutal truth they need to hear

Keep it under 150 words. Be direct. No fluff.`;

    const result = await model.generateContent(prompt);
    res.json({ plan: result.response.text(), taskTitle: task.title });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Recovery plan failed' });
  }
});

// Serve frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`👻 Deadline Ghost running on port ${PORT}`);
});
