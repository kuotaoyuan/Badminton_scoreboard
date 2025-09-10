import mediapipe as mp
import cv2
import math

cap = cv2.VideoCapture(0)

my_hands = mp.solutions.hands
mp_drawing = mp.solutions.drawing_utils
mp_drawing_styles = mp.solutions.drawing_styles

# Find angles between joints using cos(theta) = (a.b)/(|a||b|)
def find_angle(v1,v2):
    v1_x = v1[0]
    v1_y = v1[1]
    v2_x = v2[0]
    v2_y = v2[1]
    dot = v1_x * v2_x + v1_y * v2_y
    length = math.sqrt(v1_x ** 2 + v1_y ** 2) * math.sqrt(v2_x ** 2 + v2_y ** 2)
    try:
        angle = math.degrees(math.acos(dot/length))
    except:
        angle = 180
    return angle

with my_hands.Hands(
    model_complexity = 0,
    max_num_hands = 2,
    min_detection_confidence = 0.5,
    min_tracking_confidence = 0.5,) as hands:

    while True:
        ret, img = cap.read()
        if not ret:
            break

        img2 = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        results = hands.process(img2)

        if results.multi_hand_landmarks:
            for hand_landmarks in results.multi_hand_landmarks:
                mp_drawing.draw_landmarks(
                    img,
                    hand_landmarks,
                    my_hands.HAND_CONNECTIONS,
                    mp_drawing_styles.get_default_hand_landmarks_style(),
                    mp_drawing_styles.get_default_hand_connections_style())
                
        cv2.imshow("Image", img)

        if cv2.waitKey(1) == ord('q'):
            break

cap.release()
cv2.destroyAllWindows()