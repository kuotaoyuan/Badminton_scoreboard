import mediapipe as mp
import cv2
import math
import time

my_hands = mp.solutions.hands
mp_drawing = mp.solutions.drawing_utils
mp_drawing_styles = mp.solutions.drawing_styles

# angle formula using cos(theta) = (a.b)/(|a||b|)
def angle_formula(v1,v2):
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

# Calculate angles of each finger
def hand_angle(hand):
    angle_list = []

    # thumb
    angle = angle_formula(
        ((int(hand[0][0]) - int(hand[2][0])), (int(hand[0][1]) - int(hand[2][1]))), 
        ((int(hand[3][0]) - int(hand[4][0])), (int(hand[3][1]) - int(hand[4][1])))
    )
    angle_list.append(angle)

    # index finger
    angle = angle_formula(
        ((int(hand[0][0]) - int(hand[6][0])), (int(hand[0][1]) - int(hand[6][1]))), 
        ((int(hand[7][0]) - int(hand[8][0])), (int(hand[7][1]) - int(hand[8][1])))
    )
    angle_list.append(angle)

    # middle finger
    angle = angle_formula(
        ((int(hand[0][0]) - int(hand[10][0])), (int(hand[0][1]) - int(hand[10][1]))), 
        ((int(hand[11][0]) - int(hand[12][0])), (int(hand[11][1]) - int(hand[12][1])))
    )
    angle_list.append(angle)

    # ring finger
    angle = angle_formula(
        ((int(hand[0][0]) - int(hand[14][0])), (int(hand[0][1]) - int(hand[14][1]))), 
        ((int(hand[15][0]) - int(hand[16][0])), (int(hand[15][1]) - int(hand[16][1])))
    )
    angle_list.append(angle)

    # pinky
    angle = angle_formula(
        ((int(hand[0][0]) - int(hand[18][0])), (int(hand[0][1]) - int(hand[18][1]))), 
        ((int(hand[19][0]) - int(hand[20][0])), (int(hand[19][1]) - int(hand[20][1])))
    )
    angle_list.append(angle)

    return angle_list

# Hand gesture reconition
def hand_gesture(finger_angle):
    f1 = finger_angle[0]  # thumb
    f2 = finger_angle[1]  # index finger
    f3 = finger_angle[2]  # middle finger
    f4 = finger_angle[3]  # ring finger
    f5 = finger_angle[4]  # pinky

    # gesture: yay
    if f1 >= 50 and f2 < 50 and f3 < 50 and f4 >= 50 and f5 >= 50:
        return "Yay"
    else:
        return "None"


cap = cv2.VideoCapture(0) # turn on camera
fontFace = cv2.FONT_HERSHEY_SIMPLEX # font
lineType = cv2.LINE_AA # line type

with my_hands.Hands(
    model_complexity = 0,
    max_num_hands = 1,
    min_detection_confidence = 0.5,
    min_tracking_confidence = 0.5,) as hands:

    w, h = 800, 600 # width and height of the camera
    
    left_point = 0
    right_point = 0 
    last_yay_time = 0

    while True:
        ret, img = cap.read()
        img = cv2.resize(img, (w, h)) # resize the camera for higher quality
        
        if not ret:
            break

        img2 = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        results = hands.process(img2)
        cv2.putText(img, f'Left: {left_point}', (400, 100), fontFace, 1, (255, 255, 255), 2, lineType)
        cv2.putText(img, f'Right: {right_point}', (400, 200), fontFace, 1, (255, 255, 255), 2, lineType)

        if results.multi_hand_landmarks:
            for hand_landmarks in results.multi_hand_landmarks:
                finger_points = []
                
                for i in hand_landmarks.landmark:
                    x = i.x * w
                    y = i.y * h
                    finger_points.append((x,y))
                if finger_points:
                    finger_angle = hand_angle(finger_points)
                    gesture = hand_gesture(finger_angle)
                    cv2.putText(img, gesture, (30, 120), fontFace, 5, (255, 255, 255), 10, lineType)
                if gesture == "Yay":
                    current_time = time.time()
                    if current_time - last_yay_time > 1:  # 1 second cooldown
                        if x > w/2 + (w * 0.1):
                            left_point += 1
                            
                        elif x < w/2 - (w * 0.1):
                            right_point += 1
                        last_yay_time = current_time
                        
                
                
                # map the landmarks on the hand image
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