// ============================================================
// TaskNote - Simple JavaScript
// Handles: Login, Register, Logout, Tasks, Notes
// Uses: Supabase (for users, tasks, notes data)
// ============================================================

// ============================================================
// 1. SETUP: Connect to SUPABASE
// ============================================================

// IMPORTANT: Replace these two lines with YOUR OWN values.
// You get them from your Supabase project dashboard -> Settings -> API
const SUPABASE_URL = "https://hatsxbpdyvbumutuoxdk.supabase.co";        // example: https://xyzcompany.supabase.co
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhhdHN4YnBkeXZidW11dHVveGRrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg0MzUzNTMsImV4cCI6MjEwNDAxMTM1M30.kPUVcYdIcSRitEJadUHbUS18shtvQfcZQ4Z_C_fLFUo";   // long key that starts with "eyJ..."

// Create the Supabase client (this lets us talk to our database)
// IMPORTANT: The Supabase CDN library is loaded as a global object called
// "supabase". We call supabase.createClient(...) on it to create OUR client.
// We name ours "client" to avoid confusion with the library's "supabase".
// If this line fails, a popup will tell us why.
let client;
try {
    client = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    console.log("Supabase client created successfully");
} catch (err) {
    alert("Problem connecting: " + err.message + " (is the Supabase library loading?)");
}


// ============================================================
// 2. REGISTER PAGE
// ============================================================

// Check if we are on the Register page
const registerForm = document.getElementById("registerForm");
if (registerForm) {
    registerForm.addEventListener("submit", async (event) => {
        event.preventDefault(); // stop the page from reloading

        // Get the values the user typed
        const name = document.getElementById("name").value;
        const email = document.getElementById("email").value;
        const password = document.getElementById("password").value;

        // 1) Create the account in Supabase (email + password)
        const { data: authData, error: authError } = await client.auth.signUp({
            email: email,
            password: password
        });

        if (authError) {
            alert("Registration failed: " + authError.message);
            return;
        }

        // 2) Save the user's name in the "users" table
        //    authData.user.id is the unique id Supabase made for this person
        const { error: dbError } = await client
            .from("users")
            .insert([
                {
                    id: authData.user.id,
                    name: name,
                    email: email
                }
            ]);

        if (dbError) {
            alert("Could not save your name: " + dbError.message);
            return;
        }

        alert("Account created! You can now login.");
        window.location.href = "login.html"; // go to login page
    });
}


// ============================================================
// 3. LOGIN PAGE
// ============================================================

const loginForm = document.getElementById("loginForm");
if (loginForm) {
    loginForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        // Get the values the user typed
        const email = document.getElementById("email").value;
        const password = document.getElementById("password").value;

        // Sign in with email + password
        const { data, error } = await client.auth.signInWithPassword({
            email: email,
            password: password
        });

        if (error) {
            alert("Login failed: " + error.message);
            return;
        }

        alert("Welcome back, " + (data.user.email || "") + "!");
        window.location.href = "dashboard.html"; // go to dashboard
    });
}


// ============================================================
// 4. DASHBOARD PAGE
// ============================================================

// Check if we are on the Dashboard page
const taskList = document.getElementById("taskList");
if (taskList) {
    // Make sure the user is logged in
    checkLogin();

    // Show the user's name
    showWelcome();

    // Load their tasks and notes from the database
    loadTasks();
    loadNotes();

    // --- Tasks ---
    const taskForm = document.getElementById("taskForm");
    taskForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        const taskText = document.getElementById("taskInput").value;

        // Get the logged in user's id
        const user = client.auth.getUser();
        const userId = (await user).data.user.id;

        // Add the task to the database
        const { error } = await client
            .from("tasks")
            .insert([
                {
                    user_id: userId,
                    task: taskText,
                    completed: false
                }
            ]);

        if (error) {
            alert("Could not add task: " + error.message);
            return;
        }

        taskForm.reset(); // clear the input box
        loadTasks();      // refresh the list
    });

    // --- Notes ---
    const noteForm = document.getElementById("noteForm");
    noteForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        const title = document.getElementById("noteTitle").value;
        const content = document.getElementById("noteContent").value;

        const user = await client.auth.getUser();
        const userId = user.data.user.id;

        const { error } = await client
            .from("notes")
            .insert([
                {
                    user_id: userId,
                    title: title,
                    content: content
                }
            ]);

        if (error) {
            alert("Could not add note: " + error.message);
            return;
        }

        noteForm.reset();
        loadNotes();
    });

    // --- Logout ---
    const logoutBtn = document.getElementById("logoutBtn");
    logoutBtn.addEventListener("click", async (event) => {
        event.preventDefault();
        await client.auth.signOut();
        window.location.href = "login.html";
    });
}


// ============================================================
// HELPER FUNCTIONS (used above)
// ============================================================

// Make sure the user is logged in. If not, send them to login.
async function checkLogin() {
    const { data: { user } } = await client.auth.getUser();
    if (!user) {
        window.location.href = "login.html";
    }
}

// Get the user's name from the "users" table and show it.
async function showWelcome() {
    const { data: { user } } = await client.auth.getUser();
    if (!user) return;

    const { data, error } = await client
        .from("users")
        .select("name")
        .eq("id", user.id)
        .single();

    if (data && !error) {
        document.getElementById("userName").textContent = data.name;
    }
}

// Load and show all tasks for the logged in user.
async function loadTasks() {
    const { data: { user } } = await client.auth.getUser();
    if (!user) return;

    const { data, error } = await client
        .from("tasks")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true });

    if (error) {
        alert("Could not load tasks: " + error.message);
        return;
    }

    // Clear the current list and rebuild it
    taskList.innerHTML = "";

    if (!data || data.length === 0) {
        taskList.innerHTML = "<li>No tasks yet. Add one above!</li>";
        return;
    }

    data.forEach((task) => {
        const li = document.createElement("li");
        li.className = "task-item" + (task.completed ? " completed" : "");

        // A checkbox to mark complete/incomplete
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = task.completed;
        checkbox.addEventListener("change", () => toggleTask(task.id, checkbox.checked));

        // The task text
        const span = document.createElement("span");
        span.className = "task-text";
        span.textContent = task.task;

        // A delete button
        const deleteBtn = document.createElement("button");
        deleteBtn.className = "delete-btn";
        deleteBtn.textContent = "Delete";
        deleteBtn.addEventListener("click", () => deleteTask(task.id));

        li.appendChild(checkbox);
        li.appendChild(span);
        li.appendChild(deleteBtn);

        taskList.appendChild(li);
    });
}

// Mark a task as completed / not completed.
async function toggleTask(id, completed) {
    await client
        .from("tasks")
        .update({ completed: completed })
        .eq("id", id);
    loadTasks();
}

// Delete a task.
async function deleteTask(id) {
    await client
        .from("tasks")
        .delete()
        .eq("id", id);
    loadTasks();
}

// Load and show all notes for the logged in user.
async function loadNotes() {
    const { data: { user } } = await client.auth.getUser();
    if (!user) return;

    const { data, error } = await client
        .from("notes")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true });

    if (error) {
        alert("Could not load notes: " + error.message);
        return;
    }

    const notesList = document.getElementById("notesList");
    notesList.innerHTML = "";

    if (!data || data.length === 0) {
        notesList.innerHTML = "<p>No notes yet. Write one above!</p>";
        return;
    }

    data.forEach((note) => {
        const card = document.createElement("div");
        card.className = "note-card";

        const title = document.createElement("h4");
        title.textContent = note.title;

        const content = document.createElement("p");
        content.textContent = note.content;

        // Edit and Delete buttons
        const actions = document.createElement("div");
        actions.className = "note-actions";

        const editBtn = document.createElement("button");
        editBtn.className = "edit-btn";
        editBtn.textContent = "Edit";
        editBtn.addEventListener("click", () => editNote(note));

        const deleteBtn = document.createElement("button");
        deleteBtn.className = "delete-btn";
        deleteBtn.textContent = "Delete";
        deleteBtn.addEventListener("click", () => deleteNote(note.id));

        actions.appendChild(editBtn);
        actions.appendChild(deleteBtn);

        card.appendChild(title);
        card.appendChild(content);
        card.appendChild(actions);

        notesList.appendChild(card);
    });
}

// Edit a note. Fills the form with the note's current text.
function editNote(note) {
    document.getElementById("noteTitle").value = note.title;
    document.getElementById("noteContent").value = note.content;

    // Change the button to "Update Note" and update when clicked
    const form = document.getElementById("noteForm");
    const submitBtn = form.querySelector("button");
    submitBtn.textContent = "Update Note";

    // Remove old submit listener and add a new one for updating
    form.onsubmit = async (event) => {
        event.preventDefault();
        const title = document.getElementById("noteTitle").value;
        const content = document.getElementById("noteContent").value;

        await client
            .from("notes")
            .update({ title: title, content: content })
            .eq("id", note.id);

        submitBtn.textContent = "Add Note";
        form.onsubmit = null; // reset to normal
        form.reset();
        loadNotes();
    };
}

// Delete a note.
async function deleteNote(id) {
    await client
        .from("notes")
        .delete()
        .eq("id", id);
    loadNotes();
}
