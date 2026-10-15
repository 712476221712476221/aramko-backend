const express = require('express');
const axios = require('axios');
const app = express();

app.use(express.json());

// IMPORTANT: Get your API Key from Pi Developer Portal and replace this
const PI_API_KEY = 'ضع_مفتاح_API_هنا'; 
const PI_API_URL = 'https://api.minepi.com/v2';

app.post('/api/payments/approve', async (req, res) => {
    const { paymentId } = req.body;
    try {
        const response = await axios.post(`${PI_API_URL}/payments/${paymentId}/approve`, {}, {
            headers: { 'Authorization': `Key ${PI_API_KEY}` }
        });
        res.json(response.data);
    } catch (error) {
        res.status(500).json({ error: 'Failed to approve payment' });
    }
});

app.post('/api/payments/complete', async (req, res) => {
    const { paymentId, txid } = req.body;
    try {
        const response = await axios.post(`${PI_API_URL}/payments/${paymentId}/complete`, { txid }, {
            headers: { 'Authorization': `Key ${PI_API_KEY}` }
        });
        res.json(response.data);
    } catch (error) {
        res.status(500).json({ error: 'Failed to complete payment' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Backend server is running on port ${PORT}`);
});
