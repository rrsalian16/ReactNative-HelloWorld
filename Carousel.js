import * as React from 'react';
import {
  Text,
  View,
  StyleSheet,
  Image,
  Animated,
  Dimensions,
  Easing,
} from 'react-native';
import { Constants } from 'expo';
import { PanGestureHandler, State } from 'react-native-gesture-handler';
const { width: screenWidth } = Dimensions.get('window');

const enableLoop = ({ enableSnap, loop, data }) =>
  enableSnap && loop && data && data.length && data.length > 1;

const getData = props => {
  const { data } = props;
  const dataLength = data && data.length;

  if (!dataLength) {
    return [];
  }

  if (!enableLoop(props)) {
    return data;
  }

  let previousItems = [];
  let nextItems = [];
  const loopClonesPerSide = dataLength * props.loopClonesMultiplier;

  for (let i = 0; i < props.loopClonesMultiplier; i++) {
    previousItems.push(...data);
    nextItems.push(...data);
  }
  
  return previousItems.concat(data, nextItems);
};

const getCustomDataLength = props => {
  const { data } = props;
  const dataLength = data && data.length;
  if (!dataLength) {
    return 0;
  }
  return enableLoop(props) ? dataLength + 2 * dataLength : dataLength;
};

export class Carousel extends React.PureComponent {
  static defaultProps = {
    carouselWidth: screenWidth,
    itemWidth: screenWidth,
    apparitionDelay: 0,
    autoplay: true,
    autoplayInterval: 2000,
    autoplayDelay: 0,
    enableSnap: true,
    loop: true,
    loopClonesMultiplier: 2,
    dragToss: 0.05,
    friction: 1,
    tension: 0.8,
    overshootRight: true,
    overshootLeft: true,
    overshootFriction: 1,
    shouldReposition: (position, props) => {
      const loopClonesPerSide = props.data.length * props.loopClonesMultiplier;
      return (
        position >=
          props.data.length + loopClonesPerSide ||
        position <= loopClonesPerSide - 1
      );
    },
    shouldThrottle: (throttleCounter, props) => {
      return throttleCounter % props.data.length === 0;
    },
    initAnimValues: () => ({
      x: new Animated.Value(0),
      actualX: new Animated.Value(0),
      absoluteX: new Animated.Value(0),
      translationX: new Animated.Value(0),
      velocityX: new Animated.Value(0),
    }),
    updateAnimValues: ({ animValues, props }) => {
      const { actualX, translationX } = animValues;
      const {
        friction,
        overshootRight,
        overshootLeft,
        overshootFriction,
      } = props;
      const updatedActualX = Animated.add(
        actualX,
        translationX.interpolate({
          inputRange: [0, friction],
          outputRange: [0, 1],
        })
      );
      return {
        updatedActualX,
      };
    },
    renderAnimValues: ({ animValues, props }) => {
      const { updatedActualX, translationX } = animValues;
      const {
        friction,
        overshootRight,
        overshootLeft,
        overshootFriction,
      } = props;
      const renderX = updatedActualX;
      return {
        renderX,
      };
    },
    initAnimEvents: ({ animValues }) => ({
      pan: Animated.event(
        [
          {
            nativeEvent: {
              x: animValues.x,
              absoluteX: animValues.absoluteX,
              translationX: animValues.translationX,
              velocityX: animValues.velocityX,
            },
          },
        ],
        {
          useNativeDriver: true,
        }
      ),
    }),
    getPanAnimation: ({
      nativeEvent,
      animValues,
      props,
      ...animationOptions
    }) => {
      const { actualX } = animValues;
      return Animated.spring(actualX, {
        restSpeedThreshold: 1.7,
        restDisplacementThreshold: 0.4,
        velocity: nativeEvent.velocityX / props.friction,
        bounciness: 0,
        useNativeDriver: true,
        ...animationOptions,
      });
    },
    getSnapAnimation: ({ animValues, props, ...animationOptions }) => {
      const { actualX } = animValues;
      return Animated.timing(actualX, {
        duration: 200,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
        ...animationOptions,
      });
    },
  };

  constructor(props) {
    super(props);

    this.position = 0;
    this.position = props.data.length * props.loopClonesMultiplier +
        (this.position % props.data.length);
    this.lastOffsetX = -props.width * this.position;
    this.throttleCounter = 0;
    this.state = { isThrottled: false, width: props.carouselWidth };

    this.animValues = props.initAnimValues();
    this.animValues = {
      ...this.animValues,
      ...props.updateAnimValues({ animValues: this.animValues, props }),
    };
    this.animEvents = props.initAnimEvents({
      animValues: this.animValues,
    });

    this.reposition(props, this.state);
  }

  componentDidMount() {
    this._mounted = true;
    const { autoplay, apparitionDelay } = this.props;
    const apparitionCallback = () => {
      if (autoplay) {
        this.startAutoplay();
      }
    };
    // Without 'requestAnimationFrame' or a `0` timeout, images will randomly not be rendered on Android...
    requestAnimationFrame(() => {
      if (!this._mounted) {
        return;
      }

      if (apparitionDelay) {
        this._apparitionTimeout = setTimeout(() => {
          apparitionCallback();
        }, apparitionDelay);
      } else {
        apparitionCallback();
      }
    });
  }

  componentWillUnmount() {
    this._mounted = false;
    this.stopAutoplay();
    clearTimeout(this._apparitionTimeout);
    clearTimeout(this._enableAutoplayTimeout);
    clearTimeout(this._autoplayTimeout);
  }

  onHandlerStateChange = ({ nativeEvent }) => {
    const { oldState } = nativeEvent;
    if (oldState === State.ACTIVE) {
      // on release
      const {
        velocityX: currVelocityX,
        translationX: currTranslationX,
      } = nativeEvent;
      const { width } = this.state;
      const { friction, dragToss } = this.props;
      const {
        x: prevX,
        translationX: prevTranslationX,
        actualX: prevActualX,
      } = this.animValues;
      const lastOffsetX = this.lastOffsetX + currTranslationX / friction;
      const projectedX =
        (currTranslationX + dragToss * currVelocityX) / friction;
      const threshold = width / 2;
      const leftThreshold = -1 * threshold;
      const rightThreshold = threshold;
      const leftBias = projectedX <= leftThreshold;
      const rightBias = projectedX >= rightThreshold;
      const centerBias = !leftBias && !rightBias;

      let toValue = -width * this.position;
      if (leftBias) {
        const position = this.position + 1;
        toValue = -width * position;
        this.lastOffsetX = toValue;
        this.position = position;
      } else if (rightBias) {
        if (this.position === 0) {
          toValue = 0;
          this.lastOffsetX = toValue;
        } else {
          const position = this.position - 1;
          toValue = -width * position;
          this.lastOffsetX = toValue;
          this.position = position;
        }
      } else {
        this.lastOffsetX = toValue;
      }

      // animate
      prevTranslationX.setValue(0);
      prevActualX.setValue(lastOffsetX);

      const animation = this.props.getPanAnimation({
        nativeEvent,
        animValues: this.animValues,
        props: this.props,
        toValue,
      });
      animation.start(this.onAnimationEnd);

      if (this.props.autoplay) {
        clearTimeout(this.enableAutoplayTimeout);
        this.enableAutoplayTimeout = setTimeout(() => {
          this.startAutoplay();
        }, 300);
      }
    }
  };
  reposition = ({ loopClonesMultiplier, data }, { width }) => {
      const position =
        data.length * loopClonesMultiplier +
        (this.position % data.length);
      const toValue = -width * position;
      this.position = position;
      this.lastOffsetX = toValue;
      this.animValues.actualX.setValue(toValue);
  }
  onAnimationEnd = ({ finished }) => {
    if (finished) {
      if (this.props.shouldReposition(this.position, this.props)) {
        this.reposition(this.props, this.state);
      }
      if (this.state.isThrottled) {
        this.throttleCounter = 0;
        this.setState({ isThrottled: false });
      }
    } else {
      if (this.position !== this.throttlePosition) {
        this.throttlePosition = this.position;
        this.throttleCounter += 1;
        if (
          this.props.shouldThrottle(this.throttleCounter, this.props) &&
          !this.state.isThrottled
        ) {
          this.setState({ isThrottled: true });
        }
      }
    }
    this.props.onSnapToPosition &&
      this.props.onSnapToPosition(this.position % this.props.data.length);
  };
  onLayout = event => {
    if (this.props.onLayout && this.props.onLayout(event)) {
      return;
    }
    if (this.firstLayoutCalled) {
      return;
    }
    this.firstLayoutCalled = true;
    const { width, height } = event.nativeEvent.layout;
    this.setState({ width, height });
  };
  startAutoplay() {
    const { autoplayInterval, autoplayDelay } = this.props;

    if (this._autoplaying) {
      return;
    }

    clearTimeout(this._autoplayTimeout);
    this._autoplayTimeout = setTimeout(() => {
      this._autoplaying = true;
      this._autoplayInterval = setInterval(() => {
        if (this._autoplaying) {
          this.snapToNext();
        }
      }, autoplayInterval);
    }, autoplayDelay);
  }
  stopAutoplay() {
    this._autoplaying = false;
    clearInterval(this._autoplayInterval);
  }
  snapToNext() {
    const itemsLength = getCustomDataLength(this.props);
    let nextPosition = this.position + 1;
    if (nextPosition > itemsLength - 1) {
      if (!enableLoop(this.props)) {
        return;
      }
      nextPosition = 0;
    }
    const { width } = this.state;
    const position = this.position + 1;
    const toValue = -width * position;
    this.lastOffsetX = toValue;
    this.position = position;
    const animation = this.props.getSnapAnimation({
      animValues: this.animValues,
      props: this.props,
      toValue,
    });
    animation.start(this.onAnimationEnd);
  }
  onTouchStart = () => {
    if (this.props.onTouchStart && this.props.onTouchStart()) {
      return;
    }
    if (this._autoplaying) {
      this.stopAutoplay();
    }
  };
  render() {
    const { x, absoluteX, translateX, actualX, actualX2 } = this.animValues;
    const { renderX } = this.props.renderAnimValues({
      animValues: this.animValues,
      props: this.props,
    });
    return (
      <>
        <PanGestureHandler
          enabled={!this.state.isThrottled}
          onGestureEvent={this.animEvents.pan}
          onHandlerStateChange={this.onHandlerStateChange}>
          <Animated.View
            style={[
              {
                flexDirection: 'row',
                width: this.props.carouselWidth,
                height: this.state.height,
                backgroundColor: 'red'
              },
              this.props.style,
            ]}
            onTouchStart={this.onTouchStart}>
            {getData(this.props).map((item, i) => (
              <Animated.View
              key={i}
                style={[
                  {
                    position: 'absolute',
                    backgroundColor: '#42a5f5',
                    width: this.props.itemWidth,
                  },
                  {
                    transform: [
                      {
                        translateX: Animated.add(
                          renderX,
                          i * this.props.itemWidth
                        ),
                      },
                    ],
                  },
                ]}
                onLayout={this.onLayout}>
                {this.props.renderItem({ item })}
              </Animated.View>
            ))}
          </Animated.View>
        </PanGestureHandler>
      </>
    );
  }
}