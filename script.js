// script.js - Sistema de reservas para clases de spinning con mejoras
import { 
    getFirestore, 
    collection, 
    doc, 
    getDoc, 
    setDoc, 
    onSnapshot,
    query,
    where,
    getDocs,
    updateDoc,
    serverTimestamp,
    addDoc
} from "https://www.gstatic.com/firebasejs/10.11.1/firebase-firestore.js";

document.addEventListener("DOMContentLoaded", async () => {
    const seatContainer = document.getElementById("seatContainer");
    const reservaForm = document.getElementById("reservaForm");
    const db = window.db;
    
    // Variables globales
    let isAdmin = false;
    let currentDay = "martes"; // Día por defecto
    let currentTime = "18:00"; // Hora por defecto
    
    // Referencia a la colección principal de reservas
    const reservasCollection = collection(db, "reservas");
    
    // Función para obtener la referencia al documento de asientos del día seleccionado
    const getSeatsRef = () => {
        return doc(reservasCollection, `asientos_${currentDay}_${currentTime.replace(':', '')}`);
    };
    
    // Función para exportar las reservas antes de reiniciarlas
    async function exportReservationsToSheet(day, time) {
        try {
            const seatsRef = doc(reservasCollection, `asientos_${day}_${time.replace(':', '')}`);
            const seatDoc = await getDoc(seatsRef);
            
            if (!seatDoc.exists()) {
                console.log(`No hay reservas para ${day} ${time}`);
                return;
            }
            
            const reservasData = seatDoc.data();
            
            // Contar cuántos asientos están reservados
            const reservedSeats = Object.keys(reservasData).length;
            if (reservedSeats === 0) {
                console.log(`No hay asientos reservados para ${day} ${time}`);
                return;
            }
            
            // Formatear los datos para la exportación
            const exportData = {
                day: day,
                time: time,
                exportDate: new Date().toISOString(),
                reservations: reservasData,
                email: "providafitness2012@gmail.com",
                totalReserved: reservedSeats
            };
            
            // Crear un documento en una colección de exportaciones
            const exportRef = doc(collection(db, "exports"));
            await setDoc(exportRef, exportData);
            
            console.log(`✅ Datos de reservas de ${day} ${time} preparados para exportación (${reservedSeats} asientos)`);
        } catch (error) {
            console.error("Error al exportar reservas:", error);
        }
    }
    
    // Función de login para administrador
    function setupAdminLogin() {
        // Establecer la contraseña cifrada en localStorage si no existe
        if (!localStorage.getItem('adminPasswordHash')) {
            // Esta línea debe ejecutarse una sola vez o cuando se cambie la contraseña
            localStorage.setItem('adminPasswordHash', btoa("Concord@2006"));
        }
        
        const adminPanel = document.querySelector(".admin-panel");
        
        // Crear elementos para login de administrador
        const loginContainer = document.createElement("div");
        loginContainer.innerHTML = `
            <div id="adminLogin">
                <input type="password" id="adminPassword" placeholder="Contraseña de administrador">
                <button id="loginButton">Iniciar sesión</button>
            </div>
            <div id="adminControls" style="display: none;">
                <p>Sesión de administrador activa</p>
                <button id="logoutButton">Cerrar sesión</button>
                <button id="resetButton" style="background-color: #f44336; margin-left: 10px;">Reiniciar reservas</button>
                <hr>
                <p><strong>Estado:</strong> Viendo reservas para <span id="currentSession"></span></p>
            </div>
        `;
        
        // Insertar elementos de login en el panel de administración
        adminPanel.innerHTML = '';
        adminPanel.appendChild(loginContainer);
        
        // Actualizar el texto de la sesión actual
        const updateSessionText = () => {
            document.getElementById("currentSession").textContent = 
                `${capitalizeFirstLetter(currentDay)} a las ${currentTime}`;
        };

        // Capitalizar primera letra
        const capitalizeFirstLetter = (string) => {
            return string.charAt(0).toUpperCase() + string.slice(1);
        };
        
        // Manejar inicio de sesión
        document.getElementById("loginButton").addEventListener("click", () => {
            const password = document.getElementById("adminPassword").value;
            const storedHash = localStorage.getItem('adminPasswordHash');
            
            // Verificar contraseña
            if (storedHash && password === atob(storedHash)) {
                isAdmin = true;
                document.getElementById("adminLogin").style.display = "none";
                document.getElementById("adminControls").style.display = "block";
                
                // Mostrar el formulario de reserva
                reservaForm.style.display = "block";
                
                // Cambiar el cursor a pointer en los asientos
                document.querySelectorAll(".seat").forEach(seat => {
                    seat.style.cursor = "pointer";
                });
                
                updateSessionText();
                
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
            
            // Ocultar el formulario de reserva
            reservaForm.style.display = "none";
            
            // Cambiar el cursor a default en los asientos
            document.querySelectorAll(".seat").forEach(seat => {
                seat.style.cursor = "default";
            });
            
            alert("✅ Sesión de administrador cerrada");
        });
        
        // Manejar el botón de reinicio de reservas
        document.getElementById("resetButton").addEventListener("click", async () => {
            if (!confirm(`¿Estás seguro de reiniciar todas las reservas para ${currentDay} a las ${currentTime}?`)) {
                return;
            }
            
            try {
                // Exportar primero
                await exportReservationsToSheet(currentDay, currentTime.replace(':', ''));
                // Luego reiniciar
                await setDoc(getSeatsRef(), {});
                alert(`✅ Reservas reiniciadas para ${currentDay} a las ${currentTime}`);
            } catch (error) {
                console.error("Error al reiniciar reservas:", error);
                alert("❌ Error al reiniciar las reservas");
            }
        });
    }
    
    // Función para configurar los selectores de día
    function setupDaySelector() {
        const dayButtons = document.querySelectorAll(".day-btn");
        
        // Marcar el primer botón como activo por defecto
        dayButtons[0].classList.add("active");
        
        // Manejar clics en los botones de día
        dayButtons.forEach(button => {
            button.addEventListener("click", async () => {
                // Quitar la clase activa de todos los botones
                dayButtons.forEach(btn => btn.classList.remove("active"));
                
                // Añadir la clase activa al botón actual
                button.classList.add("active");
                
                // Actualizar el día y hora actual
                currentDay = button.getAttribute("data-day");
                currentTime = button.getAttribute("data-time");
                
                // Actualizar el texto de la sesión si está el admin logueado
                if (isAdmin && document.getElementById("currentSession")) {
                    document.getElementById("currentSession").textContent = 
                        `${currentDay.charAt(0).toUpperCase() + currentDay.slice(1)} a las ${currentTime}`;
                }
                
                // Cargar los asientos para este día
                await loadSeats();
            });
        });
    }
    
    // Función para cargar asientos de la base de datos
    async function loadSeats() {
        const seatsRef = getSeatsRef();
        
        // Desuscribirse de la suscripción anterior
        if (window.currentUnsubscribe) {
            window.currentUnsubscribe();
        }
        
        // Escuchar cambios en Firestore en tiempo real
        window.currentUnsubscribe = onSnapshot(seatsRef, (docSnapshot) => {
            let seatsData = {};
            if (docSnapshot.exists()) {
                seatsData = docSnapshot.data();
            } else {
                // Si el documento no existe, inicializarlo
                setDoc(seatsRef, {});
            }
            
            renderSeats(seatsData);
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
                
                // Añadir el nombre del cliente al tooltip si existe
                if (seatsData[seatNumber].nombre) {
                    seat.setAttribute("title", `Reservado por: ${seatsData[seatNumber].nombre}`);
                }
            } else {
                seat.classList.remove("sold");
                seat.classList.add("available");
                seat.removeAttribute("title");
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
                alert("Este asiento ya está reservado. Para más información, contacta al administrador.");
            } else {
                alert("Para reservar un asiento, contacta al administrador de Provida Fitness.");
            }
            return;
        }
    
        const seatNumber = clickedSeat.getAttribute("data-seat");
    
        try {
            // Obtener el estado actual de los asientos
            const seatsRef = getSeatsRef();
            const seatDoc = await getDoc(seatsRef);
            let seatsData = seatDoc.exists() ? seatDoc.data() : {};
    
            // Si el asiento ya está reservado, preguntar si desea liberarlo
            if (seatsData[seatNumber]) {
                if (confirm(`¿Deseas liberar el asiento ${seatNumber}?`)) {
                    delete seatsData[seatNumber]; // Marcar como disponible
                    await setDoc(seatsRef, seatsData);
                    console.log(`Asiento ${seatNumber} liberado`);
                }
            } else {
                // Si está disponible, mostrar el formulario y enfocar el campo de nombre
                document.getElementById("nombre").focus();
                
                // Guardar el asiento seleccionado para usarlo en el envío del formulario
                window.selectedSeat = seatNumber;
            }
        } catch (error) {
            console.error("Error al interactuar con el asiento:", error);
            alert("❌ Error al actualizar el asiento. Inténtalo de nuevo.");
        }
    });
    
    // Manejar el envío del formulario de reserva
    reservaForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        
        if (!window.selectedSeat) {
            alert("❌ Primero selecciona un asiento disponible haciendo clic en él.");
            return;
        }
        
        const nombre = document.getElementById("nombre").value.trim();
        const telefono = document.getElementById("telefono").value.trim();
        
        if (!nombre || !telefono) {
            alert("❌ Por favor completa todos los campos del formulario.");
            return;
        }
        
        try {
            // Obtener el estado actual de los asientos
            const seatsRef = getSeatsRef();
            const seatDoc = await getDoc(seatsRef);
            let seatsData = seatDoc.exists() ? seatDoc.data() : {};
            
            // Verificar que el asiento siga disponible
            if (seatsData[window.selectedSeat]) {
                alert("❌ Este asiento ya ha sido reservado. Por favor selecciona otro.");
                return;
            }
            
            // Guardar la información de la reserva
            seatsData[window.selectedSeat] = {
                nombre: nombre,
                telefono: telefono,
                fechaReserva: new Date().toISOString(),
                dia: currentDay,
                hora: currentTime
            };
            
            // Guardar en Firebase
            await setDoc(seatsRef, seatsData);
            
            // Limpiar el formulario
            document.getElementById("nombre").value = "";
            document.getElementById("telefono").value = "";
            window.selectedSeat = null;
            
            alert(`✅ Asiento ${window.selectedSeat} reservado para ${nombre} correctamente.`);
        } catch (error) {
            console.error("Error al hacer la reserva:", error);
            alert("❌ Error al guardar la reserva. Por favor intenta de nuevo.");
        }
    });
    
    // Función para programar el reinicio automático cada domingo a las 8:30
    function setupAutoReset() {
        // Verificar la hora actual y programar el próximo reinicio
        const checkAndScheduleReset = () => {
            const now = new Date();
            const day = now.getDay(); // 0 = domingo
            const hour = now.getHours();
            const minute = now.getMinutes();
            
            // Si es domingo y son las 8:30, reiniciar todas las reservas
            if (day === 0 && hour === 8 && minute === 30) {
                resetAllReservations();
            }
            
            // Calcular tiempo hasta el próximo domingo a las 8:30
            const daysUntilNextSunday = day === 0 ? 7 : 7 - day;
            const nextSunday = new Date(now);
            nextSunday.setDate(now.getDate() + daysUntilNextSunday);
            nextSunday.setHours(8, 30, 0, 0);
            
            // Si ya pasó la hora de reinicio de hoy, programar para el próximo domingo
            if (day === 0 && (hour > 8 || (hour === 8 && minute > 30))) {
                nextSunday.setDate(nextSunday.getDate() + 7);
            }
            
            const timeUntilReset = nextSunday - now;
            console.log(`Próximo reinicio programado en ${Math.floor(timeUntilReset / (1000 * 60 * 60))} horas.`);
            
            // Programar el próximo reinicio
            setTimeout(resetAllReservations, timeUntilReset);
        };
        
        // Función para reiniciar todas las reservas
        const resetAllReservations = async () => {
            try {
                const days = ["martes", "jueves", "sabado", "domingo"];
                const times = ["18:00", "08:00"];
                
                // Exportar y reiniciar cada combinación de día y hora
                for (const day of days) {
                    for (const time of times) {
                        // Solo exportar y reiniciar las combinaciones válidas según el horario
                        if ((day === "martes" || day === "jueves") && time === "18:00") {
                            await exportReservationsToSheet(day, "1800");
                            await setDoc(doc(reservasCollection, `asientos_${day}_1800`), {});
                        } else if ((day === "sabado" || day === "domingo") && time === "08:00") {
                            await exportReservationsToSheet(day, "0800");
                            await setDoc(doc(reservasCollection, `asientos_${day}_0800`), {});
                        }
                    }
                }
                
                console.log("✅ Reinicio automático completado");
                
                // Programar el próximo reinicio
                checkAndScheduleReset();
            } catch (error) {
                console.error("Error en el reinicio automático:", error);
                
                // Intentar de nuevo en 5 minutos
                setTimeout(resetAllReservations, 5 * 60 * 1000);
            }
        };
        
        // Iniciar el proceso de programación
        checkAndScheduleReset();
    }
    
    // Inicializar componentes
    setupAdminLogin();
    setupDaySelector();
    await loadSeats();
    setupAutoReset();
});