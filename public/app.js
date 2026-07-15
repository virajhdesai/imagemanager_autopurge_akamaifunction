// --- NAVIGATION CONTROLLER ---
function switchTab(tabId, element) {
    const targets = document.querySelectorAll('.tab-content');
    targets.forEach(t => t.classList.remove('active'));

    const buttons = document.querySelectorAll('.tab-btn');
    buttons.forEach(b => b.classList.remove('active'));

    document.getElementById(tabId).classList.add('active');
    element.classList.add('active');
}

// --- CART LOGIC ---
let cart = [];

function updateCartUI() {
    const itemsContainer = document.getElementById('cart-items');
    const countBadge = document.getElementById('cart-count');
    const totalContainer = document.getElementById('cart-total-val');

    if (cart.length === 0) {
        itemsContainer.innerHTML = '<p style="color: #a0aec0; font-style: italic; text-align: center;">Your cart is empty.</p>';
        countBadge.innerText = '0';
        totalContainer.innerText = '0.00';
        return;
    }

    let total = 0;
    let count = 0;

    itemsContainer.innerHTML = cart.map(item => {
        total += item.price * item.quantity;
        count += item.quantity;
        return `
            <div class="cart-item">
                <div><strong>${item.name}</strong> x${item.quantity}</div>
                <div style="color: #0052cc; font-weight: bold;">($${(item.price * item.quantity).toFixed(2)})</div>
            </div>
        `;
    }).join('');

    countBadge.innerText = count;
    totalContainer.innerText = total.toFixed(2);
}

function addToCart(id, name, price) {
    const existingItem = cart.find(item => item.id === id);
    if (existingItem) {
        existingItem.quantity += 1;
    } else {
        cart.push({ id, name, price, quantity: 1 });
    }
    updateCartUI();
}

function clearCart() {
    cart = [];
    updateCartUI();
}

async function checkout() {
    if (cart.length === 0) {
        alert("Your cart is empty! Add items before checking out.");
        return;
    }

    const checkoutBtn = document.getElementById('checkout-btn');
    checkoutBtn.innerText = "Processing Order...";
    checkoutBtn.disabled = true;

    try {
        const response = await fetch('/api/checkout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items: cart })
        });

        const result = await response.json();

        if (response.ok) {
            alert(`🎉 Checkout Successful!\n\nOrder ID: ${result.orderId}\nTotal Paid: $${result.totalPrice}\n\n${result.message}`);
            clearCart();
        } else {
            alert("Checkout Failed: " + result.error);
        }
    } catch (error) {
        alert("Network connection error encountered during edge transaction processing.");
    } finally {
        checkoutBtn.innerText = "Proceed to Checkout";
        checkoutBtn.disabled = false;
    }
}

// --- SUPPORT CONTACT HANDLING ---
async function handleContactSubmit(event) {
    event.preventDefault();

    const name = document.getElementById('contact-name').value;
    const email = document.getElementById('contact-email').value;
    const message = document.getElementById('contact-message').value;
    const formBtn = document.getElementById('contact-btn');

    formBtn.innerText = "Dispatching Ticket...";
    formBtn.disabled = true;

    try {
        const response = await fetch('/api/contact', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, message })
        });

        const result = await response.json();

        if (response.ok) {
            alert(`✉️ Message Delivered!\n\nTicket Reference: ${result.ticketId}\n\nThank you, ${result.receivedFrom}. We will be in touch shortly.`);
            document.getElementById('contact-form').reset();
        } else {
            alert("Submission Error: " + result.error);
        }
    } catch (err) {
        alert("Could not reach support infrastructure endpoint at this moment.");
    } finally {
        formBtn.innerText = "Send Support Request";
        formBtn.disabled = false;
    }
}

// --- EDGE CHAT INTERACTIVE CHANNEL ---
function sendChatMessage() {
    const input = document.getElementById('chat-input');
    const chatBox = document.getElementById('chat-box');
    const userText = input.value.trim();

    if (!userText) return;

    chatBox.innerHTML += `<div class="chat-msg user">${userText}</div>`;
    input.value = '';
    chatBox.scrollTop = chatBox.scrollHeight;

    setTimeout(() => {
        let reply = "I'm not sure about that item, but all our merchandise is cached natively on global edge nodes for speed!";
        const lower = userText.toLowerCase();

        if (lower.includes('hoodie') || lower.includes('clothing')) {
            reply = "The Akamai Edge Hoodie features optimized dynamic layer compression—perfect for cold weather debugging loops!";
        } else if (lower.includes('sneaker') || lower.includes('shoes')) {
            reply = "WebAssembly sneakers optimize every footstep execution down to machine speeds. Highly recommended!";
        } else if (lower.includes('backpack') || lower.includes('bag')) {
            reply = "The Cloud Storage backpack has near-infinite object storage paths. Completely safe from data packet drops.";
        } else if (lower.includes('price') || lower.includes('cost')) {
            reply = "Our prices range from $35.00 to $89.95. Add items to your shopping cart to see your total calculated instantaneously.";
        } else if (lower.includes('contact') || lower.includes('support') || lower.includes('help')) {
            reply = "To get specialized support, just click the 'Contact Us' tab at the top of the page to submit a priority message directly to our engineering desk!";
        }

        chatBox.innerHTML += `<div class="chat-msg bot">${reply}</div>`;
        chatBox.scrollTop = chatBox.scrollHeight;
    }, 600);
}