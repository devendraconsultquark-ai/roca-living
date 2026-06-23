import axios from "axios";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

export function useLogin() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState('');
    const navigate = useNavigate();

    async function handleSubmit(e) {

        e.preventDefault();
        
        if (!email || !password) {
            setError("Email and  password are required");
            return;
        }
        const payload = {
            email: email,
            password: password
        }
        try {
            setError("");

            const res = await axios.post("http://localhost:9000/api/v1/auth/login", payload, {withCredentials: true});

            navigate("/dashboard")
        } catch (error) {
            console.log("error :", error)

            const errorMessage = error.response?.data?.message || "Something went wrong";
            setError(errorMessage);
        }
    }

    return { email, setEmail, password, setPassword, error, setError, handleSubmit }
}