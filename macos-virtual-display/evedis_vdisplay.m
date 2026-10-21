#import <Foundation/Foundation.h>
#import <CoreGraphics/CoreGraphics.h>
#import <signal.h>
#import <time.h>
#import <stdlib.h>

@interface CGVirtualDisplayDescriptor : NSObject
@property (nonatomic, copy) NSString *name;
@property (nonatomic, assign) unsigned int maxPixelsWide;
@property (nonatomic, assign) unsigned int maxPixelsHigh;
@property (nonatomic, assign) CGSize sizeInMillimeters;
@property (nonatomic, strong) dispatch_queue_t queue;
@property (nonatomic, assign) unsigned int vendorID;
@property (nonatomic, assign) unsigned int productID;
@property (nonatomic, assign) unsigned int serialNum;
@end

@interface CGVirtualDisplayMode : NSObject
- (instancetype)initWithWidth:(unsigned int)width height:(unsigned int)height refreshRate:(double)rate;
@end

@interface CGVirtualDisplaySettings : NSObject
@property (nonatomic, copy) NSArray *modes;
@property (nonatomic, assign) unsigned int hiDPI;
@end

@interface CGVirtualDisplay : NSObject
- (instancetype)initWithDescriptor:(CGVirtualDisplayDescriptor *)descriptor;
- (BOOL)applySettings:(CGVirtualDisplaySettings *)settings;
@property (nonatomic, readonly) CGDirectDisplayID displayID;
@end

static CGVirtualDisplay *gDisplay = nil;
static BOOL gRunning = YES;
static NSString *gPosition = @"right";

void handleSignal(int sig) {
    gRunning = NO;
    CFRunLoopStop(CFRunLoopGetMain());
}

// Function to arrange secondary display relative to main display
BOOL arrangeDisplay(CGDirectDisplayID secID, NSString *position) {
    CGDirectDisplayID mainID = CGMainDisplayID();
    CGRect mainBounds = CGDisplayBounds(mainID);
    CGRect secBounds = CGDisplayBounds(secID);

    int32_t targetX = 0;
    int32_t targetY = 0;

    if ([position isEqualToString:@"left"]) {
        targetX = -(int32_t)secBounds.size.width;
        targetY = 0;
    } else if ([position isEqualToString:@"top"]) {
        targetX = 0;
        targetY = -(int32_t)secBounds.size.height;
    } else if ([position isEqualToString:@"bottom"]) {
        targetX = 0;
        targetY = (int32_t)mainBounds.size.height;
    } else { // default "right"
        targetX = (int32_t)mainBounds.size.width;
        targetY = 0;
    }

    CGDisplayConfigRef configRef;
    CGError err = CGBeginDisplayConfiguration(&configRef);
    if (err != kCGErrorSuccess) {
        return NO;
    }

    // Explicitly anchor main display at (0, 0)
    CGConfigureDisplayOrigin(configRef, mainID, 0, 0);

    // Place secondary display at target offset
    err = CGConfigureDisplayOrigin(configRef, secID, targetX, targetY);
    if (err != kCGErrorSuccess) {
        CGCancelDisplayConfiguration(configRef);
        return NO;
    }

    // kCGConfigureForSession ensures configuration applies to this session without permanently
    // recording sticky window-to-display mappings in WindowServer preferences
    err = CGCompleteDisplayConfiguration(configRef, kCGConfigureForSession);
    return (err == kCGErrorSuccess);
}

// Ensure browser windows (e.g. Google Chrome host controller) remain on the main screen
void ensureWindowsOnMainDisplay(CGRect mainBounds) {
    dispatch_async(dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_DEFAULT, 0), ^{
        usleep(100000); // 100ms
        NSString *script = [NSString stringWithFormat:
            @"tell application \"System Events\"\n"
            @"  if exists (process \"Google Chrome\") then\n"
            @"    tell application \"Google Chrome\"\n"
            @"      repeat with w in windows\n"
            @"        try\n"
            @"          set b to bounds of w\n"
            @"          set x1 to item 1 of b\n"
            @"          set y1 to item 2 of b\n"
            @"          set x2 to item 3 of b\n"
            @"          set y2 to item 4 of b\n"
            @"          set wWidth to x2 - x1\n"
            @"          set wHeight to y2 - y1\n"
            @"          if x1 >= %.0f or x1 < 0 then\n"
            @"            set newX1 to 50\n"
            @"            set newY1 to 50\n"
            @"            set bounds of w to {newX1, newY1, newX1 + wWidth, newY1 + wHeight}\n"
            @"          end if\n"
            @"        end try\n"
            @"      end repeat\n"
            @"    end tell\n"
            @"  end if\n"
            @"end tell", mainBounds.size.width];
        NSAppleScript *as = [[NSAppleScript alloc] initWithSource:script];
        [as executeAndReturnError:nil];
    });
}

int main(int argc, const char * argv[]) {
    @autoreleasepool {
        unsigned int width = 1920;
        unsigned int height = 1200;
        double fps = 60.0;
        unsigned int hidpi = 1;
        NSString *name = @"EVEDIS Tablet Display";
        gPosition = @"right";

        for (int i = 1; i < argc; i++) {
            NSString *arg = [NSString stringWithUTF8String:argv[i]];
            if ([arg isEqualToString:@"--width"] && i + 1 < argc) {
                width = (unsigned int)atoi(argv[++i]);
            } else if ([arg isEqualToString:@"--height"] && i + 1 < argc) {
                height = (unsigned int)atoi(argv[++i]);
            } else if ([arg isEqualToString:@"--fps"] && i + 1 < argc) {
                fps = atof(argv[++i]);
            } else if ([arg isEqualToString:@"--name"] && i + 1 < argc) {
                name = [NSString stringWithUTF8String:argv[++i]];
            } else if ([arg isEqualToString:@"--hidpi"] && i + 1 < argc) {
                hidpi = (unsigned int)atoi(argv[++i]);
            } else if ([arg isEqualToString:@"--position"] && i + 1 < argc) {
                gPosition = [NSString stringWithUTF8String:argv[++i]];
            }
        }

        signal(SIGINT, handleSignal);
        signal(SIGTERM, handleSignal);

        CGVirtualDisplayDescriptor *desc = [[NSClassFromString(@"CGVirtualDisplayDescriptor") alloc] init];
        desc.name = name;
        desc.maxPixelsWide = width;
        desc.maxPixelsHigh = height;
        desc.sizeInMillimeters = CGSizeMake(216, 135);
        desc.vendorID = 0x4556; // 'EV'
        // Dynamic productID and serialNum prevent macOS WindowServer from recalling old window-to-display mappings
        desc.productID = (unsigned int)(0x0001 + (arc4random() % 0xFFFE));
        desc.serialNum = (unsigned int)time(NULL) ^ (arc4random() & 0xFFFF);
        desc.queue = dispatch_get_main_queue();

        gDisplay = [[NSClassFromString(@"CGVirtualDisplay") alloc] initWithDescriptor:desc];
        if (!gDisplay) {
            fprintf(stderr, "{\"error\": \"Failed to create CGVirtualDisplay\"}\n");
            return 1;
        }

        CGVirtualDisplayMode *mode = [[NSClassFromString(@"CGVirtualDisplayMode") alloc] initWithWidth:width height:height refreshRate:fps];
        CGVirtualDisplaySettings *settings = [[NSClassFromString(@"CGVirtualDisplaySettings") alloc] init];
        settings.modes = @[mode];
        settings.hiDPI = hidpi;

        BOOL success = [gDisplay applySettings:settings];
        if (!success) {
            fprintf(stderr, "{\"error\": \"Failed to apply display settings\"}\n");
            return 1;
        }

        CGDirectDisplayID displayID = gDisplay.displayID;

        // Position the display (left or right)
        arrangeDisplay(displayID, gPosition);
        CGRect bounds = CGDisplayBounds(displayID);
        CGRect mainBounds = CGDisplayBounds(CGMainDisplayID());

        // Ensure Chrome stays on Screen 1
        ensureWindowsOnMainDisplay(mainBounds);

        // Print initial status JSON
        printf("{\"status\": \"active\", \"displayID\": %u, \"width\": %u, \"height\": %u, \"boundsWidth\": %.0f, \"boundsHeight\": %.0f, \"originX\": %.0f, \"originY\": %.0f, \"position\": \"%s\", \"fps\": %.1f, \"name\": \"%s\"}\n",
               displayID, width, height, bounds.size.width, bounds.size.height, bounds.origin.x, bounds.origin.y, [gPosition UTF8String], fps, [name UTF8String]);
        fflush(stdout);

        // Read commands from stdin: e.g. "arrange:left\n", "arrange:right\n"
        dispatch_async(dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_DEFAULT, 0), ^{
            char buffer[256];
            while (fgets(buffer, sizeof(buffer), stdin) != NULL) {
                NSString *line = [[NSString stringWithUTF8String:buffer] stringByTrimmingCharactersInSet:[NSCharacterSet whitespaceAndNewlineCharacterSet]];
                if ([line hasPrefix:@"arrange:"]) {
                    NSString *newPos = [line substringFromIndex:8];
                    dispatch_async(dispatch_get_main_queue(), ^{
                        BOOL ok = arrangeDisplay(displayID, newPos);
                        CGRect nb = CGDisplayBounds(displayID);
                        printf("{\"event\": \"arranged\", \"success\": %s, \"position\": \"%s\", \"originX\": %.0f, \"originY\": %.0f}\n",
                               ok ? "true" : "false", [newPos UTF8String], nb.origin.x, nb.origin.y);
                        fflush(stdout);
                    });
                }
            }
            // Stdin closed -> exit
            dispatch_async(dispatch_get_main_queue(), ^{
                gRunning = NO;
                CFRunLoopStop(CFRunLoopGetMain());
            });
        });

        while (gRunning) {
            CFRunLoopRunInMode(kCFRunLoopDefaultMode, 1.0, true);
        }

        printf("{\"status\": \"destroyed\"}\n");
        fflush(stdout);
    }
    return 0;
}
