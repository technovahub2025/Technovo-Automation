import { useEffect, useContext } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AuthContext } from "./authcontext";
import axios from "axios";

const AuthCallback = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { login } = useContext(AuthContext);

  useEffect(() => {
    const token = params.get("token");
    if (!token) {
      navigate("/login", { replace: true });
      return;
    }

    try {
      const API_URL = import.meta.env.VITE_API_ADMIN_URL;
      const TOKEN_KEY = import.meta.env.VITE_TOKEN_KEY || "authToken";
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem("authToken", token);

      axios
        .get(`${API_URL}/api/user/credentials`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        .then((res) => {
          const data = res?.data?.data || {};
          const user = {
            id: data.userId,
            email: data.email,
            role: data.role || "user",
            companyId: data.companyId,
            companyRole: data.companyRole
          };
          login(user, token);
          navigate("/", { replace: true });
        })
        .catch(() => {
          navigate("/login", { replace: true });
        });
    } catch {
      navigate("/login", { replace: true });
    }
  }, [params, navigate, login]);

  return null;
};

export default AuthCallback;
