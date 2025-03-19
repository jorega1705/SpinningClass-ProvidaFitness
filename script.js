// script.js modificado para incluir autenticación de administrador
import { getFirestore, collection, doc, getDoc, setDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-firestore.js";

document.addEventListener("DOMContentLoaded", async () => {
    const seatContainer = document.getElementById("seatContainer");
    const db = window.db;
    const seatsRef = doc(collection(db, "reservas"), "asientos");
    
    // Variable global para controlar el rol del usuario
    let isAdmin = false;
    
    // Función de login para administrador
    function setupAdminLogin() {
        const adminPanel = document.querySelector(".admin-panel");
        
        // Crear elementos para login de administrador
        const loginContainer = document.createElement("div");
        loginContainer.innerHTML = `
            <div id="adminLogin" style="margin-bottom: 15px;">
                <input type="password" id="adminPassword" placeholder="Contraseña de administrador">
                <button id="loginButton">Iniciar sesión</button>
            </div>
            <div id="adminControls" style="display: none;">
                <p>Sesión de administrador activa</p>
                <button id="logoutButton">Cerrar sesión</button>
                <hr>
            </div>
        `;
        
        // Insertar elementos de login antes del primer elemento en el panel de administración
        adminPanel.insertBefore(loginContainer, adminPanel.firstChild);
        
        // Ocultar el botón de cambiar disponibilidad inicialmente
        document.querySelector(".admin-panel button[onclick='toggleSeats()']").style.display = "none";
        
        // Manejar inicio de sesión
        document.getElementById("loginButton").addEventListener("click", () => {
            const password = document.getElementById("adminPassword").value;
            // Reemplaza "admin123" con una contraseña más segura en producción
            if (password === "Concord@2006") {
                isAdmin = true;
                document.getElementById("adminLogin").style.display = "none";
                document.getElementById("adminControls").style.display = "block";
                document.querySelector(".admin-panel button[onclick='toggleSeats()']").style.display = "inline-block";
                
                // Cambiar el cursor a pointer en los asientos para mostrar que son interactivos
                document.querySelectorAll(".seat").forEach(seat => {
                    seat.style.cursor = "pointer";
                });
                
                alert("✅ Sesión de administrador iniciada correctamente");
            } else {
                alert("❌ Contraseña incorrecta");
            }
        });
        
        // Manejar cierre de sesión
        document.getElementById("logoutButton").addEventListener("click", () => {
            isAdmin = false;
            document.getElementById("adminLogin").style.display = "block";
            document.getElementById("adminControls").style.display = "none";
            document.querySelector(".admin-panel button[onclick='toggleSeats()']").style.display = "none";
            
            // Cambiar el cursor a default en los asientos para mostrar que no son interactivos
            document.querySelectorAll(".seat").forEach(seat => {
                seat.style.cursor = "default";
            });
            
            alert("✅ Sesión de administrador cerrada");
        });
    }
    
    // Función para renderizar los asientos en la pantalla
    function renderSeats(seatsData) {
        document.querySelectorAll(".seat").forEach(seat => {
            const seatNumber = seat.getAttribute("data-seat");
            
            // Actualizar la apariencia según el estado en la base de datos
            if (seatsData[seatNumber]) {
                seat.classList.remove("available");
                seat.classList.add("sold");
            } else {
                seat.classList.remove("sold");
                seat.classList.add("available");
            }
            
            // Configurar el cursor según el rol del usuario
            seat.style.cursor = isAdmin ? "pointer" : "default";
        });
    }

    // Manejar clics en asientos - Solo funciona para administradores
    seatContainer.addEventListener("click", async (event) => {
        const clickedSeat = event.target;
        if (!clickedSeat.classList.contains("seat")) return;
    
        // Solo permitir cambios si es administrador
        if (!isAdmin) {
            if (clickedSeat.classList.contains("sold")) {
                alert("Este asiento ya está reservado");
            } else {
                alert("Para reservar un asiento, contacta a Sergio");
            }
            return;
        }
    
        const seatNumber = clickedSeat.getAttribute("data-seat");
    
        try {
            // Obtener el estado actual de los asientos
            const seatDoc = await getDoc(seatsRef);
            let seatsData = seatDoc.exists() ? seatDoc.data() : {};
    
            // Alternar disponibilidad del asiento
            if (seatsData[seatNumber]) {
                console.log(`Liberando asiento ${seatNumber}`);
                delete seatsData[seatNumber]; // Marcar como disponible
            } else {
                console.log(`Reservando asiento ${seatNumber}`);
                seatsData[seatNumber] = true; // Reservar asiento
            }
    
            // Guardar el nuevo estado en Firestore
            await setDoc(seatsRef, seatsData);
            console.log("Reserva guardada en Firebase");
        } catch (error) {
            console.error("Error al actualizar el asiento:", error);
            alert("Error al actualizar el asiento. Inténtalo de nuevo.");
        }
    });
    
    // Implementar la función toggleSeats que estaba llamada en el HTML
    window.toggleSeats = function() {
        alert("Haga clic en los asientos para cambiar su disponibilidad");
    };

    // Escuchar cambios en Firestore en tiempo real
    onSnapshot(seatsRef, (docSnapshot) => {
        if (docSnapshot.exists()) {
            const seatsData = docSnapshot.data();
            renderSeats(seatsData);
        } else {
            // Si el documento no existe, inicializarlo
            setDoc(seatsRef, {});
        }
    });
    
    // Configurar el sistema de login
    setupAdminLogin();
});