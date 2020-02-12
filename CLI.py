import asyncio
import websockets
import numpy as np
import cv2
import requests
import sys
import argparse
import os
import time
import json
import ssl
import urllib.parse
import base64
import ssl

debug = False

class Utils:
    def waitKey(t):
        global debug
        pressed_key = cv2.waitKey(t) if t >= 0 else -1
        if pressed_key == 27:
            sys.exit(0)
        if debug and pressed_key > 0:
            print("You have typed {} ({})".format(pressed_key, chr(pressed_key)))
        return pressed_key

    def imshow(name, img, width = 400, height = 600, wait=-1):
        cv2.namedWindow(name, cv2.WINDOW_NORMAL)
        cv2.resizeWindow(name, width, height)
        cv2.imshow(name, img)
        return Utils.waitKey(wait)

    def show_image(img, title, frame_number, wait, msg=None):
        height,width = img.shape[:2]
        ratio = 800 / height
        width = int(width * ratio)
        height = int(height * ratio)
        img = cv2.resize(img, (width, height))

        font = cv2.FONT_HERSHEY_PLAIN
        font_scale = 2
        thickness = 2
        text = str(frame_number) + (" [{}]".format(msg) if msg else "")
        text_size,_ = cv2.getTextSize(text, font, font_scale, thickness)
        w,h = text_size
        margin = 15
        cv2.rectangle(img, (0,0), (w + 2 * margin, h + 2 * margin), (0,225,245), cv2.FILLED)
        cv2.putText(img, text, (margin, margin + h), font, font_scale, 0, thickness)
        return Utils.imshow(title, img, width=width, height=height, wait=wait)

    def makedirs(path):
        if not os.path.exists(path):
            os.makedirs(path)

    def cmd_to_url(cmd):
        if cmd == "or" or cmd == "object_removal":
            return "/test/object_removal?debug=2"
        elif cmd == "ss" or cmd == "surface_segmentation":
            return "/test/surface_segmentation"
        elif cmd == "sd" or cmd == "surface_detection":
            return "/test/surface_detection"
        elif cmd == "st" or cmd == "surface_transformation":
            return "/test/surface_transformation"
        elif cmd == "ce" or cmd == "content_extraction":
            return "/test/content_extraction"
        elif cmd == "surface_stabilization":
            return "/test/surface_stabilization"
        elif cmd == "ipsa":
            return "/test/ipsa"

class InputReader:
    def __init__(self, args):
        self.args = args
        self.observers = set()
        self.frame_num = 0

    def attach(self, o):
        self.observers.add(o)

    def __skip_frames(self, cap, skip):
        ret = True

        while skip > 1 and ret is True:
           ret,frame = cap.read()
           if ret is True:
               self.frame_num = self.frame_num + 1
           skip = skip - 1

    def __imread(self, cap):
        ret,img = cap.read()
        if ret is not True:
            cap.release()
            return None
        else:
            self.frame_num = self.frame_num + 1
            return img

    def __resize(self, img):
        w,h = img.shape[:2]
        if w < h:
            return cv2.resize(img, (1920,1080))
        else:
            return cv2.resize(img, (1080,1920))

    def __check_rotation(self, file_path):
        try :
            import ffmpeg
            # this returns meta-data of the video file in form of a dictionary
            # from the dictionary, meta_dict['streams'][0]['tags']['rotate'] is the key
            # we are looking for
            meta_dict = ffmpeg.probe(file_path)
            rotation_angle = int(meta_dict['streams'][0]['tags']['rotate'])
        except:
            rotation_angle = None

        if rotation_angle is None:
            try:
                from PIL import Image, ExifTags
                image = Image.open(file_path)
                for orientation in ExifTags.TAGS.keys():
                    if ExifTags.TAGS[orientation]=='Orientation':
                        break
                exif=dict(image._getexif().items())
                if exif[orientation] == 8:
                    rotation_angle = 270
                elif exif[orientation] == 3:
                    rotation_angle = 180
                elif exif[orientation] == 6:
                    rotation_angle = 90
                image.close()
            except:
                pass

        if rotation_angle is None:
            rotation_angle = getattr(self.args, 'rotate', 0)
        rotation_angle = rotation_angle % 360

        if rotation_angle == 90:
            return cv2.ROTATE_90_CLOCKWISE
        elif rotation_angle == 180:
            return cv2.ROTATE_180
        elif rotation_angle == 270:
            return cv2.ROTATE_90_COUNTERCLOCKWISE
        else:
            return None

    def __export_image(self, response, cmd, frame_num):
        if response.get('input', None) is None:
            print("Skipping export")
            return

        timestr = time.strftime("%Y%m%d%H%M%S")
        print('saving image to \"export\" directory ...')

        export_path = "export/{}/".format(cmd)
        Utils.makedirs(export_path)

        fname = "{}/{}-f{}.input.jpg".format(export_path, timestr, frame_num)
        img = response.get('input', None)
        if img is not None:
            img = base64.b64decode(img)
            with open(fname, 'wb') as f:
                f.write(img)

        fname = "{}/{}-f{}.output.jpg".format(export_path, timestr, frame_num)
        img = response.get('output', None)
        if img is not None:
            img = base64.b64decode(img)
            with open(fname, 'wb') as f:
                f.write(img)


    async def __on_input_image(self, img, frame_num):
        Utils.show_image(img, 'input', frame_num, wait=100, msg='Processing')

        _, imencoded = cv2.imencode(".jpg", img)
        await self.websocket.send(imencoded.tobytes())

        while True:
            response = await self.websocket.recv()
            response = json.loads(response)
            if response.get('warning') is not None:
                print(response)
                key = None
                continue
            elif response.get('error') is not None:
                msg = response.get('error')
                key = Utils.show_image(img, 'input', frame_num, wait=self.args.wait, msg=msg)
                break
            elif response.get('debug') is not None:
                Utils.show_image(img, 'input', frame_num, wait=100, msg=None)
                output = response.get('debug')
                output = base64.b64decode(output)
                output = np.frombuffer(output, dtype=np.uint8)
                output = cv2.imdecode(output, 1)
                key = Utils.show_image(output, 'output', frame_num, wait=self.args.wait, msg=None)
                break
            elif response.get('svg') is not None:
                svg = response.get('svg')
                key = None
                with open('ipsa.svg', 'w') as f:
                    f.write(svg)
                break
            elif response.get('corners') is not None:
                h,w = img.shape[:2]
                corners = response.get('corners')
                corners = [[v['x'],v['y']] for v in corners]
                corners = np.array(corners, dtype=np.float32)
                corners = (corners * [w,h] / 100).astype(np.int)
                cv2.polylines(img, [corners], isClosed=True, color=(0,0,255), thickness=4)
                Utils.show_image(img, 'output', frame_num, wait=self.args.wait, msg=None)
                key = None
                break

        if key == ord('e') or key == ord('E'):
            Utils.show_image(img, 'input', frame_num, wait=100, msg="Exporting")
            self.__export_image(response, self.args.command, frame_num)
            Utils.show_image(img, 'input', frame_num, wait=0, msg="Exported")

    async def __init_connection(self):
        username = urllib.parse.quote(self.args.username)
        password = urllib.parse.quote(self.args.password)
        command = self.args.command
        parsed = urllib.parse.urlparse(self.args.endpoint)
        uri = f'{parsed.scheme}://{username}:{password}@{parsed.netloc}/test/{command}'
        ssl_context = ssl.SSLContext()
        ssl_context.verify_mode = ssl.CERT_NONE
        ssl_context.check_hostname = False
        self.websocket = await websockets.connect(uri, ssl=ssl_context if parsed.scheme == 'wss' else None)
        response = await self.websocket.recv()
        response = json.loads(response)
        version = response.get('version')
        if version is not None:
            print(f"Connected to IPSA version {version}")

        await self.websocket.send(json.dumps({
            'cmd': 'type',
            'data': self.args.type
            }))

    async def run(self):
        await self.__init_connection()

        for src in self.args.src:
            self.frame_num = 0
            rotate = self.__check_rotation(src)

            cap = cv2.VideoCapture(src)
            self.__skip_frames(cap, self.args.seek)

            while cap.isOpened():
                frame = self.__imread(cap)
                if frame is None:
                    continue
                elif rotate is not None:
                    frame = cv2.rotate(frame, rotate)
                frame = self.__resize(frame)
                await self.__on_input_image(frame, self.frame_num)
                self.__skip_frames(cap, self.args.skip)

        await self.websocket.close()

def __prepare_args(args):
    if args.config is not None:
        with open(args.config) as f:
            config = json.load(f)
            for k,v in config.items():
                args.__dict__[k] = v

    if args.debug:
        global debug
        debug = args.debug

    if args.command is None:
        raise Exception("Command is required")

    if args.endpoint is None:
        raise Exception("Endpoint has not specified")

    if args.command == 'ce':
        args.command = 'content_extraction'
    elif args.command == 'st':
        args.command = 'surface_transformation'
    elif args.command == 'ss':
        args.command = 'surface_segmentation'
    elif args.command == 'sd':
        args.command = 'surface_detection'
    elif args.command == 'or':
        args.command = 'object_removal'

async def main():
    parser = argparse.ArgumentParser()
    cmds = ['surface_segmentation', 'surface_detection', 'surface_transformation', 'content_extraction', 'object_removal', 'ipsa', 'ipsasvg', 'surface_stabilization', 'ss', 'sd', 'st', 'ce', 'or']
    parser.add_argument("src", type=str, nargs='+', help='Video or image file')
    parser.add_argument("-c", "--command", type=str, required=False, choices=cmds, help='command to execute')
    parser.add_argument("-w", "--wait", type=int, default=0, metavar='>= 0', help="The amount of time waits between images. 0 means wait forever until a key pressed. \
                         Other values greater than 0 is wait time in millisecond. If the pressed key(during the wait time) is \'e\', then the shown image will save in an \
                         \"export\" directory in your current directory, then proceed. \'Esc\' key will terminate the program and other keys will ignore and proceed to the next image.")
    parser.add_argument("-f", "--config", required=True, help='Path to json file containing configuration')
    parser.add_argument("-r", "--rotate", type=int, default=0, help="Rotate images")
    parser.add_argument("-s", "--skip", type=int, default=0, help="Process every 'n' frames")
    parser.add_argument("--seek", type=int, default=0, help="Seek to 'n' frames")
    args = parser.parse_args()

    try:
        __prepare_args(args)
    except Exception as e:
        parser.print_help()
        print("************************************************************")
        print(str(e))
        print("************************************************************")
        sys.exit(0)

    await InputReader(args).run()

if __name__ == '__main__':
    asyncio.get_event_loop().run_until_complete(main())
