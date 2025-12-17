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
    let currentDay = "lunes"; // Día por defecto
    let currentTime = "18:00"; // Hora por defecto
    
    // Función para obtener la referencia al documento de asientos del día seleccionado
    // Garantizamos un formato consistente para las referencias de documentos
    const getSeatsRef = () => {
        return doc(reservasCollection, `asientos_${currentDay}_${currentTime.replace(':', '')}`);
    };
    
    // Referencia a la colección principal de reservas
    const reservasCollection = collection(db, "reservas");
    
    // Función para exportar las reservas antes de reiniciarlas
    async function exportReservationsToSheet(day, time) {
        try {
            // Aseguramos un formato consistente para la hora
            const formattedTime = time.replace(':', '');
            const seatsRef = doc(reservasCollection, `asientos_${day}_${formattedTime}`);
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
            <div style="display: flex; justify-content: space-between; margin-bottom: 15px;">
                <button id="logoutButton">Cerrar sesión</button>
                <button id="resetButton" style="background-color: #f44336;">Reiniciar reservas</button>
            </div>
            <hr>
            <p><strong>Estado:</strong> Viendo reservas para <span id="currentSession"></span></p>
            <p id="databaseStatus"></p>
        </div>
        `;
        
        // Insertar elementos de login en el panel de administración
        adminPanel.innerHTML = '';
        adminPanel.appendChild(loginContainer);
        
        // Actualizar el texto de la sesión actual
        const updateSessionText = () => {
            const element = document.getElementById("currentSession");
            if (element) {
                element.textContent = `${capitalizeFirstLetter(currentDay)} a las ${currentTime}`;
            }
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
                
                // Verificar estado de la base de datos inmediatamente
                checkDatabaseConnection();
                
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
                await exportReservationsToSheet(currentDay, currentTime);
                // Luego reiniciar
                await setDoc(getSeatsRef(), {});
                alert(`✅ Reservas reiniciadas para ${currentDay} a las ${currentTime}`);
            } catch (error) {
                console.error("Error al reiniciar reservas:", error);
                alert("❌ Error al reiniciar las reservas");
            }
        });
    }
    
    // Función para verificar la conexión con la base de datos
    async function checkDatabaseConnection() {
        try {
            // Intentar leer el documento actual
            const seatsRef = getSeatsRef();
            const docSnap = await getDoc(seatsRef);
            
            const statusElement = document.getElementById("databaseStatus");
            if (statusElement) {
                if (docSnap.exists()) {
                    const seatsData = docSnap.data();
                    const reservedCount = Object.keys(seatsData).length;
                    statusElement.innerHTML = `✅ Conectado a Firebase: ${reservedCount} asientos reservados`;
                    statusElement.style.color = "green";
                } else {
                    statusElement.innerHTML = "✅ Conectado a Firebase: No hay reservas en este día/hora";
                    statusElement.style.color = "green";
                }
            }
            return true;
        } catch (error) {
            console.error("Error al verificar conexión con Firebase:", error);
            const statusElement = document.getElementById("databaseStatus");
            if (statusElement) {
                statusElement.innerHTML = "❌ Error de conexión con Firebase";
                statusElement.style.color = "red";
            }
            return false;
        }
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
                if (isAdmin) {
                    const element = document.getElementById("currentSession");
                    if (element) {
                        element.textContent = `${capitalizeFirstLetter(currentDay)} a las ${currentTime}`;
                    }
                    
                    // Actualizar el estado de la base de datos
                    checkDatabaseConnection();
                }
                
                // Cargar los asientos para este día
                await loadSeats();
            });
        });
        
        // Función auxiliar para capitalizar
        function capitalizeFirstLetter(string) {
            return string.charAt(0).toUpperCase() + string.slice(1);
        }
    }
    
    // Función para cargar asientos de la base de datos
    async function loadSeats() {
        try {
            const seatsRef = getSeatsRef();
            
            // Desuscribirse de la suscripción anterior
            if (window.currentUnsubscribe) {
                window.currentUnsubscribe();
            }
            
            console.log(`Cargando asientos para: ${currentDay} ${currentTime}`);
            console.log(`Referencia del documento: asientos_${currentDay}_${currentTime.replace(':', '')}`);
            
            // Escuchar cambios en Firestore en tiempo real
            window.currentUnsubscribe = onSnapshot(seatsRef, (docSnapshot) => {
                let seatsData = {};
                if (docSnapshot.exists()) {
                    seatsData = docSnapshot.data();
                    console.log(`Datos cargados: ${Object.keys(seatsData).length} asientos reservados`);
                } else {
                    // Si el documento no existe, NO lo inicializamos automáticamente
                    // Esto previene el reinicio de reservas
                    console.log("Documento no existe, pero NO se inicializará automáticamente");
                    // Eliminamos la inicialización automática: setDoc(seatsRef, {});
                }
                
                renderSeats(seatsData);
            }, (error) => {
                console.error("Error al cargar asientos:", error);
                alert("Error al cargar los asientos. Verifica tu conexión a internet.");
            });
        } catch (error) {
            console.error("Error en loadSeats:", error);
        }
    }
    
    // Función para renderizar los asientos en la pantalla
    function renderSeats(seatsData) {
    document.querySelectorAll(".seat").forEach(seat => {
        const seatNumber = seat.getAttribute("data-seat");

        // Mostrar todos los asientos para todas las clases
    seat.style.display = "block";

        // Mostrar estado (reservado o disponible)
        if (seatsData[seatNumber]) {
            seat.classList.remove("available");
            seat.classList.add("sold");

            // Mostrar quién reservó si hay nombre
            if (seatsData[seatNumber].nombre) {
                seat.setAttribute("title", `Reservado por: ${seatsData[seatNumber].nombre}`);
            }
        } else {
            seat.classList.remove("sold");
            seat.classList.add("available");
            seat.removeAttribute("title");
        }

        // Estilo según si es admin
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
            let seatsData = {};
            
            if (seatDoc.exists()) {
                seatsData = seatDoc.data();
            }
    
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
            let seatsData = {};
            
            // Inicializamos el documento si no existe
            if (seatDoc.exists()) {
                seatsData = seatDoc.data();
            }
            
            // Verificar que el asiento siga disponible
            if (seatsData[window.selectedSeat]) {
                alert("❌ Este asiento ya ha sido reservado. Por favor selecciona otro.");
                return;
            }
            
            // Guardar la información de la reserva con hora local del usuario
            const fechaLocal = new Date();
            seatsData[window.selectedSeat] = {
                nombre: nombre,
                telefono: telefono,
                fechaReserva: fechaLocal.toISOString(),
                fechaReservaLocal: fechaLocal.toLocaleString(), // Hora local formateada
                dia: currentDay,
                hora: currentTime
            };
            
            // Guardar en Firebase
            await setDoc(seatsRef, seatsData);
            
            // Limpiar el formulario
            document.getElementById("nombre").value = "";
            document.getElementById("telefono").value = "";
            const selectedSeat = window.selectedSeat;
            window.selectedSeat = null;
            
            alert(`✅ Asiento ${selectedSeat} reservado para ${nombre} correctamente.`);
        } catch (error) {
            console.error("Error al hacer la reserva:", error);
            alert("❌ Error al guardar la reserva. Por favor intenta de nuevo.");
        }
    });
    
    // Botón para forzar la recarga de datos
    if (isAdmin) {
        const reloadButton = document.createElement("button");
        reloadButton.textContent = "🔄 Forzar recarga de datos";
        reloadButton.style.marginTop = "10px";
        reloadButton.style.backgroundColor = "#4285F4";
        reloadButton.addEventListener("click", async () => {
            try {
                await loadSeats();
                alert("✅ Datos recargados correctamente");
            } catch (error) {
                console.error("Error al recargar datos:", error);
                alert("❌ Error al recargar los datos");
            }
        });
        
        const adminControls = document.getElementById("adminControls");
        if (adminControls) {
            adminControls.appendChild(reloadButton);
        }
    }
    
    // Inicializar componentes
    setupAdminLogin();
    setupDaySelector();
    await loadSeats();
    
    // Establecer un intervalo para verificar la conexión periódicamente (solo para admin)
    if (isAdmin) {
        setInterval(checkDatabaseConnection, 60000); // Cada minuto
    }
});